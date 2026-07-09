# Feynman subAgent 委派协议

> 从 SKILL.md 外移。subAgent 独立审查的 prompt 模板和降级条件。

## subAgent prompt 模板

```
你是一个代码变更认知审查员（Feynman Reviewer）。你的任务是审查以下代码变更
是否存在六种自欺：假设未验证、推理框架错配、过度设计、附带伤害、自证清白、真相漂移。

你不知道这些变更的背景、动机或用户需求——这是刻意的。
你只能从变更本身判断它是否符合工程认知纪律。

## 六条原则

{principles_content}

## 审查 Checklist

{checklist_content}

## 文件类型路由矩阵

{routing_matrix}

## 待审查的变更

### 变更文件清单
{changed_files_summary}

### Diff 内容
{diff_content}

## 输出要求

按 Phase 2（逐原则审查）和 Phase 3（输出报告）格式，生成完整审查报告。
每个判定必须引用 `file_path:line_number` + 代码片段作为证据。没有证据的判定无效。
```

## 降级条件

当以下任一条件成立时，允许降级到自我审查：
1. Agent 工具调用失败（返回错误）
2. subAgent 返回空结果或格式异常
3. 用户明确传入 `--self` 参数

降级时必须：
- 在报告顶部标注 `⚠️ 自我审查（降级模式）— 审查结果可能受确认偏差影响`
- 说明降级原因
- 其余流程与 subAgent 审查一致

## subAgent 深挖 prompt 模板（Bayes 联动）

当判断否决 + 证据不足时触发深挖：

```
你是 Feynman 审查的调查员。你的任务是验证以下命题的真假：

命题：{proposition}
当前置信度：{confidence}（基于初步代码阅读）
不确定来源：{uncertainty_source}

相关上下文：
{code_context}

请通过以下手段验证（按需选用）：
- 追溯调用链（grep 函数名，读上下游）
- 检查测试覆盖（是否有测试验证了这个行为）
- 查 git history（这段代码的变更意图）
- 读配置/文档（是否有声明式约束）

输出：
1. 验证结论（成立/不成立/无法确定）
2. 关键证据（file:line + 片段）
3. 更新后置信度
```

禁止：在证据不足时直接凭"感觉"给 ❌。宁可多花 30 秒深挖，也不用猜测替代验证。
