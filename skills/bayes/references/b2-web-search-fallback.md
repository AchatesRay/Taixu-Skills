# B2 软验证降级方案：WebSearch 替代异构模型

## 问题

bayes B2 软验证默认使用 Claude + Qwen 双模型对抗解读。当 Qwen（通过 idealab_client.py）不可用时，B2 无法正常运行，Agent B 返回 `direction=ambiguous`，导致验证无效、D11 停留在 3-4 分。

## 降级方案

### B2（soft_search）: WebSearch 独立验证

当 Qwen 不可用时，Agent B 降级为 WebSearch 独立验证：

1. **Agent A（Claude）**：解读 Stage 1 获取的源文档（不变）
2. **Agent B（Claude + WebSearch）**：
   - 使用 WebSearch 搜索因子关键词（与 Stage 1 不同的查询角度）
   - 从搜索结果中独立提取方向性信号
   - 判断方向：positive / negative / neutral / ambiguous
   - 标注 `degraded_mode: "web_search_fallback"`

**独立性机制**：Agent A 和 Agent B 基于不同的信息源做判断。Agent A 使用 Stage 1 获取的源文档，Agent B 使用独立 WebSearch 结果。虽然同一模型，但不同输入数据提供了一定程度的独立性——比同模型双提示词（L1 single）更强，因为数据源不同而非仅提示词不同。

### B2c（soft_read）: 单模型双视角验证

代码场景无外部可搜索的信息源，降级为单模型双视角：

1. **Agent A（Claude）**：关注主线逻辑（函数签名、返回值、调用链）
2. **Agent B（Claude）**：关注异常路径（边界条件、错误处理、副作用）
3. 标注 `degraded_mode: "single_model_degraded"`

## 降级触发与标注

**触发条件**（任一即触发）：
- idealab_client.py 不可用（文件不存在或执行报错）
- Qwen API 返回错误或超时
- 用户显式指定 `--verify-mode single`

**报告标注**：
- `b2_mode`: `"heterogeneous"` | `"degraded"`
- `degraded_reason`: `"qwen_unavailable"` | `"user_specified"` | `"api_timeout"`
- Agent B 结果中 `key_evidence` 前标注 `[web_search_fallback]` 或 `[degraded_single_model]`

## 评分影响

| D11 分数 | B2 模式要求 | WebSearch 降级是否满足 |
|----------|------------|----------------------|
| 3-4 | 无 B2 软验证 | ❌（需运行 B2） |
| 5-6 | B2 软验证运行（**可为降级模式**） | ✅ 满足 |
| 7-8 | B2 异构模型验证 | ❌（需双模型） |
| 9-10 | B2 异构模型一致率 ≥80% | ❌（需双模型） |

## 限制

1. **同模型偏差**：Claude 对相同信息可能有系统性偏差，WebSearch 降级无法消除
2. **搜索质量依赖**：WebSearch 结果质量影响 Agent B 判断准确性
3. **建议**：重要验证场景仍应使用 L2 异构模式（Claude + Qwen）
