# 跨 Skill 触发协议

> 从 SKILL.md 外移。debono 与其他 skill 的联动协议。

## hegel → debono（S7 黄帽对冲）

**触发条件**：hegel 报告中 >70% 的初始发现被标记为 `dismissed` 或 `excluded`

**输入提取规则**（从 hegel 报告中提取）：

```yaml
proposition: <hegel 报告中被 excluded/dismissed 的 findings 列表>
context: <hegel 报告的 scope + convergence summary>
```

**输出嵌入**：debono 输出可直接追加到 hegel 报告末尾的 `## 黄帽对冲（debono 价值回溯）` 段落。

## feynman ↔ debono（双方论证）

对同一命题分别调用 feynman 和 debono，获得正反两面：
- feynman 输出：自欺点 + 未验证假设
- debono 输出：存活论证 + 四维价值
- 用户综合两面做最终决策

## debono ↔ bayes 联动（概率反馈环）

在太虚五转 pipeline 中，bayes（三转·叩实）在 debono（五转·归真）之前运行。debono 可以读取 bayes 的验证报告，将其作为存活条件的先验概率来源。

**数据流**：

```
bayes report（验证结果 + 置信度）
    ↓
debono 存活条件 ← 匹配 → bayes prediction / premise_audit
    ↓                    ↓
    未匹配条件           已验证先验（来自 bayes 验证结果）
    ↓                    ↓
    debono 自行估计      confirmed → 先验=高
    （标注「未验证先验」）  refuted → 先验=低
    ↓
    未验证条件 → 标记为后续 bayes 验证候选（反馈环）
```

**匹配规则**：
- debono 的存活条件与 bayes 的 prediction（或 premise_audit）在语义上匹配时，使用 bayes 的验证结果作为先验
- bayes 验证结果 `status=confirmed` → 先验概率 = 高（映射 80-100%），`confidence=high` 时取上限
- bayes 验证结果 `status=refuted` → 先验概率 = 低（映射 0-20%）
- bayes 验证结果 `status=unverified` 或 `actual_direction=unavailable` → 不匹配，debono 自行估计

**反馈环**：debono 输出中标记为「未验证先验」的存活条件，可作为下一轮 bayes 验证的输入。pipeline 不会自动触发新一轮 bayes，但在五转综合总结中会列出未验证条件清单。

**独立调用**：debono 独立调用（非 pipeline 模式）时，无 bayes 报告可用，所有存活条件均由 debono 自行估计并标注「未验证先验」。

## 沉默触发器

在对话过程中，当检测到以下信号时，**建议**用户触发 debono（建议模式，非自动执行）：

| 信号 | 识别方式 | 建议话术 |
|------|----------|----------|
| hegel dismiss 比例 >70% | 从 hegel 报告中读取 dismiss 统计 | 「收敛结果中大部分发现被排除了，要不要跑一轮 debono 看看有没有被误杀的？」 |
| 用户犹豫 | 用户表达「觉得有道理但不确定」「被否了但还想再看看」 | 「听起来你对这个结论有保留，要不要用 debono 做一轮价值回溯？」 |
| feynman 后直觉反抗 | 用户看完 feynman 审查后表达「说得对但我不想放弃」 | 「费曼找到了漏洞，但如果你觉得核心想法仍有价值，debono 可以帮你构建存活论证」 |
