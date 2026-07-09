# 报告格式与 Severity-Confidence 耦合规则

> 从 SKILL.md §11.4-11.5 移出。S7 报告生成时加载。

## 报告结构

报告文件必须包含 YAML frontmatter，供 pipeline checkpoint 提取信号：

```markdown
---
signals:
  terminal_status: "converged | converged_with_blind_spots | converged_with_counterbalance | truncated | truncated_with_blind_spots | aborted"
  system_type: "deterministic | non_deterministic | mixed"
---

# 收敛分析报告：{target}

## 收敛摘要
| 指标 | 值 |
|------|-----|
| 分析轮次 | {rounds} |
| 终态 | {status} |
| 总发现数 | {total} |
| 按类型收敛 | deterministic: N/M, epistemic: N/M, ontological: N/M |

## 确认的问题（按严重度排序）
### {severity} {F_id}：{description}
- 证据 / 置信度历程 / 贝叶斯分析 / 偏差检查 / 深化评估
- effective_severity = {raw_severity} → {adjusted_severity}（confidence: {conf}）

## 零假设检验

> 如果原方案大体正确（零假设成立），我们应该看到什么证据？

| # | 零假设断言 | 验证结果 | 证据 |
|---|-----------|---------|------|
| H1 | {如果方案没问题，X 应该是这样} | ✅ 通过 / ❌ 未通过 | {具体证据} |

**零假设结论**：{N/M 条零假设通过 → 方案核心合理/存在系统性问题}

> ⚠️ 如果零假设检验全部缺失（0 条），报告结论的可信度降低——分析可能过度聚焦于「找问题」而忽视了「确认合理」。

## 已排除的问题
## 未收敛的问题（如有）
## 归真对冲扫描（debono，如触发）
## 边界漂移检查（如有）
## 审计日志
```

报告路径：`docs/hegel-reports/{target_slug}-hegel-{date}.md`

## Severity-Confidence 耦合规则

severity 判定必须考虑 confidence（即断言为真的概率），而非仅基于 impact（断言为真时的影响）。

**规则**：
- `effective_severity = f(raw_severity, confidence)`
- confidence < 0.6 → critical 自动降为 major
- confidence < 0.4 → critical 自动降为 minor
- 各 lens severity 判定表的 critical 行必须包含 confidence 约束列

**理由**：低置信度断言因「最坏情况思维」获得 critical 标签——把不确定猜测包装成紧急问题。C1 被标为 critical（最高严重度）但置信度仅 0.55（刚过硬币翻转），就是典型反例。

**报告展示**：每条 finding 同时展示 raw_severity 和 effective_severity，让读者清楚看到 confidence 对严重度的影响。

## 规格化桥接提示

findings 中的 confirmed/uncertain 条目可被提取为 R-numbered Requirements（如 "R1. MUST 解决 F3 指出的 X 问题"），用于后续 liam-plan/hegel --spec-only 规格化输入。
