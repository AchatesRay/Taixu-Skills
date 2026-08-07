---
name: debono
display_name: "太虚五转 · 归真（德伯诺）"
description: "Recover（归真·太虚五转）：被过度批判命题的最强存活论证。触发词：归真, debono, 价值回溯, 被过度批判, 黄帽, 再想想, /debono."
version: "2.4.0"
visibility: public
last_updated: "2026-07-19"
metadata:
  visibility: public
  stage: 太虚五转（回溯，价值回溯）
  hat: yellow
  risk: low
  capabilities: []
  status: V2.4.0
---

# Debono 德伯诺回溯 · 太虚五转·归真

> *"The purpose of thinking is to abolish thinking."*
> — Edward de Bono
>
> 批判能找到漏洞，但找不到价值。归真是在批判的废墟里，捡回不该被埋没的东西。

## 概述

方案被批判管线打得很惨。但被否的不一定是错的，可能只是论证不完整、证据还没到、角度被忽略。这个 skill 为被质疑的命题构建最强存活论证：明确它在什么条件下仍然成立，从四个维度扫描被忽略的价值。

太虚五转第五转：归真（回溯）。散怀、澄源、叩实、破妄、归真，五转闭环。批判管线的终点，是回溯的起点。

## 定位

Feynman 审查产出、Bayes 验证结论、Hegel 收敛认知，这三者形成了一条强大的批判管线。但批判管线有盲区：它擅长排除，不擅长保留。Debono 补的是这块盲区：**给被否定的命题做逆向价值扫描**，不问"为什么错"，问"在什么条件下对"。

五转分工表 SSOT 在 taixu-pipeline：`references/methodology-mapping.md` § 五转分工表。debono 在其中的定位：🟡 黄帽，**回溯**——找回被误杀的价值，问「被否掉的东西，有没有被忽略的价值？」。

## 铁律

执行 debono 时，**禁止**在输出中出现以下内容：

- "但是"、"不过"、"然而"、"风险在于"、"潜在问题"
- 任何形式的风险提示、问题指出、"值得注意"的转折
- 隐性批判："这个方案虽然…但…"的句式

你是**辩护律师**，不是法官。法官的工作由 feynman/think-tool 承担。
唯一例外：在"存活条件"段落中，可以诚实说明"命题在什么条件下**不**成立"——这是边界标注，不是批判。

## 构建方法论

从 5 种构建策略（S1 逆向利益相关方 / S2 条件缩窄法 / S3 时间延迟价值 / S4 类比复活法 / S5 反面代价法）中选择最适用的 3-4 种组合使用。每种策略有明确的分析路径，禁止凭空编造正面理由。

**完整决策表**——策略详情、problem_type 适配、乐观强度旋钮（L1/L2）、策略选择决策树（按否定类型推荐优先级）、输入输出 schema、触发场景、显式拒绝、边界条件、反模式——见 [references/decision-tables.md](references/decision-tables.md)。

四维框架的理论根基详见 [references/methodology.md](references/methodology.md)。

## 执行流程

```
命题输入 → 构建存活论证 → 明确存活条件 → 贝叶斯概率量化 → 四维价值扫描 → 输出 → [五转总结]
```

1. **接收命题**：单条或列表，带或不带上下文
2. **构建最强存活论证**：从 5 种构建策略中选择 3-4 种，沿分析路径生成论证
3. 🟡 **CHECKPOINT — 存活论证确认**：展示构建的存活论证摘要，询问用户：「以上存活论证方向是否正确？需要调整或补充角度吗？」用户确认后继续
4. **明确存活条件**：诚实标注——什么情况下成立、什么情况下不成立
5. **贝叶斯概率量化**：为每个存活条件估计概率，计算期望存活概率。详见 [references/bayesian-quantification.md](references/bayesian-quantification.md)
6. **四维价值扫描**：从用户价值、技术收益、团队成长、战略对齐四个维度扫描被忽略的价值
7. **输出**：Markdown 段落，可直接嵌入 hegel 报告或其他文档
8. **🔒 五转综合总结（强制）**：当 debono 作为太虚五转管线的最后一步执行时，**必须**生成五转综合总结文档。详见 [references/pipeline-summary.md](references/pipeline-summary.md)

## 跨 Skill 触发协议

含 hegel→debono 黄帽对冲（>70% dismissed 触发）、feynman↔debono 双方论证、debono↔bayes 概率反馈环（先验来源 + 反馈环）、沉默触发器（3 信号建议模式）。详见 [references/cross-skill-protocol.md](references/cross-skill-protocol.md)。
