---
name: bayes
display_name: "太虚三转 · 叩实（贝叶斯）"
description: 'Verify（验证·太虚三转·叩实）: decompose conclusion → testable predictions → external data validation. Use when user says "验证", "贝叶斯", "bayes", "靠谱吗", "深挖", "/bayes".'
version: "4.6.0"
visibility: public
last_updated: "2026-07-19"
kind: composed
metadata:
  author: "Antifragile Research Team"
  origin: "v3.4 三视角诊断 + depth-engine-principles v1.2 定稿 + spike 验证，2026-06-06"
  risk: medium
  capabilities:
    - filesystem-write
    - network
composition:
  execution: scripts/workflow.js
  final_output: report
---

# Bayes 贝叶斯验证

> 你说"应该是 X"。真的吗？这个 skill 帮你查。
> 把结论拆成预测，拿真实数据去验，预测错了的地方就是你的盲区。

> *"The first principle is that you must not fool yourself — and you are the easiest person to fool."*
> — Richard Feynman

## 概述

结论有了：投资判断、技术选型，方案推荐。但经得起推敲吗？有没有可能在自欺？感觉上没问题，但拿不出硬数据证明？

把结论拆成可验证的预测，拿外部真实数据逐条检验：查 API 返回、读代码实现，调两个 AI 模型交叉对质。预测被数据打脸的地方就是盲区。和费曼（破妄）审查产出物不同，和黑格尔，澄源收敛认知不同，贝叶斯，叩实验证的是结论本身。打脸越狠，认知增量越大。用事实冲击结论，而不是用逻辑自圆其说。每条预测标注验证结果 —通过、部分通过，被推翻、无法验证。最终输出一份证据清单，让你清楚看到哪些结论站得住、哪些需要修正，哪些还悬着。

太虚五转第三转：叩实（验证）。用事实而非逻辑检验结论。没有外部事实冲击，就没有认知进步。

## 工作流概览（v4.0）

```
你的结论 → 拆成具体预测（"如果结论成立，那么 A/B/C 应该是这样"）
          → 用 API 查真实数据，看预测对不对
          → 用两个不同的 AI 模型独立解读原始资料，交叉验证
          → 汇总：哪些预测被数据打脸了？打脸的地方就是你需要重新思考的
```

四步走：

1. **拆预测**（Phase 1）— 把笼统结论拆成具体的、可查证的方向性预测。**每个核心断言必须同时拆出两个方向**：证伪预测（falsification_prediction）和零假设预测（null_hypothesis_prediction）。
   - **数量下限（门禁，按 problem_type 分档）**：non_deterministic ≥10 条，deterministic / mixed ≥7 条。低于下限必须补拆；断言集合确实拆解穷尽时，在报告 frontmatter 显式降级 `prediction_floor`——禁止静默以少充数。
2. **硬验证**（B1）— 调 API 查数据 / 跑 shell 命令查代码，用代码判断预测是否成立。
   - **基线实测铁律** —凡断言涉及可本地度量的数字（性能/数量/覆盖率/耗时），必须亲手跑命令取数，禁止引用估计值或记忆中的旧数。证据清单中每条数据标注来源类型：`[实测]`，本次亲手跑出或 `[外部]`，API/文献/他人报告。
3. **软验证**（B2）— 让 Claude 和 Qwen 各自独立解读原始资料/代码，看是否一致
4. **找盲区**（汇总）— 预测和实际不一致的地方 = 你的认知盲区

---

## 用之前说几句实话

1. **AI 审自己有天花板**：多个 AI 独立审查能提供一些交叉验证，但它们共享同一类训练数据，可能有共同盲区。大事还是找个真人看看。
2. **"没发现问题"不等于"没问题"**：只能说在我能查到的范围内没找到矛盾，不代表结论一定对。
3. **一次只验一个结论**：真实决策往往要比好几个方案。这里的输出只是参考之一，不是最终答案。
4. **概率是粗略的**：报告里的概率和误差范围是 AI 估的，有最低误差保护（±5pp 起），别当精确值看。

---

## 执行方式

本 skill 通过 Workflow script 执行（`scripts/workflow.js`），支持循环和并行 subagent。

**输入**：
```yaml
claim: string          # 必填。你的结论或判断（一句话）
thesis_path: string    # 可选。相关分析文档的路径
problem_type: string   # 可选。pipeline 传入（deterministic / non_deterministic / mixed / pending）
verify_mode: string    # 可选。验证模式（single / dual / triple），默认 dual
```

**输出**：验证报告（预测清单 + 数据验证结果 + 盲区清单），保存到对应目录下。

---

## 核心机制：预测 → 验证 → 找盲区

```
Phase 1                    B1                    B2                    汇总
拆预测                →   查数据             →   交叉验证           →   找盲区
把结论拆成具体预测      用 API 查真实数据       两个 AI 独立解读        预测 vs 实际
检查预测是否够具体      代码判断方向对不对       Claude vs Qwen         不一致 = 盲区
每个断言拆两个方向：
  证伪方向 + 零假设方向
```

**完整决策表**——边界条件、七条设计原则（D1-D7）、精确数据源约束（evidence_precision）、验证维度，金融×3+代码×3、B2 双模型交叉验证，L1-L3+UltraPlan 并行、与其他 Skill 配合，常见审查偏差速查、按不确定性类型的深挖角度，problem_type 适配、理论基石 8 条，常见踩坑反模式——见 [references/decision-tables.md](references/decision-tables.md)。

理论基石详见 [theoretical-foundations.md](references/theoretical-foundations.md)，认识论纪律和 [depth-engine-principles.md](references/depth-engine-principles.md)，v4.0 北极星。偏差清单详见 [bias-checklist.md](references/bias-checklist.md)。B2 WebSearch 降级详见 [b2-web-search-fallback.md](references/b2-web-search-fallback.md)。

---

## 规格化桥接提示

> 💡 **规格化桥接提示**：验证通过的预测（prediction + verified=true）可被提取为 Success Criteria，如 "SC1. 当 X 条件成立时，Y 指标应在 Z 范围内"，用于后续 liam-plan/hegel 规格化输入。

---

## 文件结构

```
bayes/
├── SKILL.md                    # 本文件
├── DESIGN.md                   # 设计方案
├── manifest.json
├── scripts/
│   ├── workflow.js             # v4.0 深度引擎（预测→测量→惊讶）
│   ├── workflow-v3.js          # v3.4 备份（对抗审查循环）
│   └── spike-v4.js             # v4.0 基础设施验证 spike
├── agents/
│   └── interface.yaml          # 输入输出接口定义
├── references/
│   ├── decision-tables.md           # 全部决策表（边界条件/原则/验证维度/B2/配合/偏差/反模式）
│   ├── theoretical-foundations.md   # 认识论纪律
│   ├── depth-engine-principles.md   # v4.0 深度引擎设计原则（北极星）
│   ├── bias-checklist.md            # 通用偏差清单（v3.4 遗产）
│   ├── b2-web-search-fallback.md    # B2 WebSearch 降级方案
│   └── lens-bayes.md                # hegel 独立调用时领域适配
└── templates/
    └── report-template.md
```
