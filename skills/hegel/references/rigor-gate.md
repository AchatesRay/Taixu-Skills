# S2.5 Rigor Gate — 断言质量预筛

> 从 SKILL.md §5.5 移出。S2 提取后、S3 校准前执行。

## 六维探针

| 维度 | 检查问题 | 评分 |
|------|---------|------|
| **evidence** | 这个断言有证据支撑吗？还是纯凭直觉？ | 0-2 |
| **specificity** | 够具体可验证吗？还是模糊到无法证伪？ | 0-2 |
| **counterfactual** | 考虑过反面吗？是否存在确认偏差？ | 0-2 |
| **simplicity** | 是最简充分解释吗？存在更简单的替代解释吗？（奥卡姆剃刀） | 0-2 |
| **attachment** | 是否过度依赖某个人/系统/历史决策？ | 0-2 |
| **durability** | 时间维度上站得住吗？6 个月后还成立吗？ | 0-2 |

### simplicity 评分标准

| 分值 | 含义 |
|------|------|
| 2 | 最简充分解释，无更简单替代 |
| 1 | 存在更简单替代但当前解释也合理 |
| 0 | 明显过度复杂，存在更简单的解释 |

## 判定规则

```
rigor_score = sum(6 维得分) / 12    # 归一化到 0-1

if rigor_score >= 0.6:  pass → 进入 S3
if rigor_score >= 0.3:  flag → 标记 weak_evidence，进入 S3（S4 feynman 重点关注）
if rigor_score < 0.3:  dismiss → 追加到 dismissed_claims[]，不进入 S3
```

## Lens 定制

Lens 文件 §7 `rigor_probes` 可配置：
- 启用/禁用特定维度（如 code lens 禁用 durability）
- 调整阈值（如 investment lens 提高 evidence 阈值到 0.7）
- 新增领域特定维度

## 产出

- `claims[]` 每条追加 `rigor_score` + `rigor_flags[]`
- `dismissed_claims[]` 记录被过滤的断言及理由
- state.json `rigor_summary` 记录通过率、各维度平均分

## 来源

ce-brainstorm 废弃后，其 rigor probes 能力（本质为收敛行为）归入 hegel。
