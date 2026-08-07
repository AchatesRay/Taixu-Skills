---
name: taixu-debate
display_name: "太虚辩论（混合盲辩）"
description: >
  五角色四轮混合盲辩压测：奥斯本/黑格尔/贝叶斯/费曼/德博诺（发散/收敛/验证/审查/归真）
  对高 stakes 命题（投资决策/战略选择/认知求真）对撞辩论，产出辩论精华 + 三区（共识/分歧/未决）+ 综合判断。
  触发词：辩论、辩论一下、太虚辩论、混合盲辩、taixu-debate、/taixu-debate。
  NOT for: 日常分析、pipeline 替代、低 stakes 命题、不可证伪的泛论。
version: "0.8.0"
kind: composed
visibility: public
last_updated: "2026-07-20"
metadata:
  stage: 太虚五转衍生（独立姊妹 skill）
  risk: medium
  status: active
  origin_skill: taixu-debate-skill-spec-2026-07-17
---

# Taixu-Debate 太虚辩论

> 五个认知角色对同一命题盲辩交锋，在隔离中独立立论，在汇总后交叉反驳。
> 不是串联审查（太虚五转 pipeline），是四轮对撞压测。

## 概述

高 stakes 命题定论前（投资决策、战略选择、认知求真），太虚五转提供串联审查范式（pipeline 顺序执行），但缺少五角色四轮对撞的压测机制。taixu-debate 让五位大师人格——**奥斯本**（发散）、**黑格尔**（收敛）、**贝叶斯**（验证）、**费曼**（审查）、**德博诺**（归真）——在同一辩题上同时盲立论，交叉回应后防御/修正立场，产出辩论精华 + 三区（共识/分歧/未决）+ 综合判断 + 按命题类型分流的结论产出。

角色不是五原子 skill 的流程复刻，而是从五原子认知功能提炼的**立场化辩论人格**：各自带着自己的核心关切和攻击面进入辩论，互相挑战对方的盲区。五原子 skill 零修改，角色快照是独立副本。辩论发言、引用标记、报告中一律使用大师名；英文 ID（divergent 等）仅用于 subagent 类型与文件命名。

五位大师之外设主持人格**西塞罗**（Cicero，罗马议事主持人、交叉质证律师、文辞家）：编排层的人格化，负责赛程控制、引用校验、数据审查、三区归纳、裁决书与实录文书。西塞罗由主 agent 扮演，有程序权与记录权但没有裁决权，永不下场辩论。快照见 [references/roles/host.md](references/roles/host.md)。

## 场景限定（R6）

**触发条件**（pipeline 后置）：
- 命题必须是高 stakes 判断，属三类之一：投资决策型（有具体标的与仓位动作）、选择决策型（技术选型/战略路径/方案取舍）、认知求真型（理解现象、检验叙事）
- 已经过太虚五转 pipeline 至少一轮收敛（不允许对原始发散结果直接辩论）
- 命题可证伪（含明确的方向性预测，非纯描述性陈述）

**假命题入场识别**（拒绝以下输入）：
- 不可证伪的陈述（如"市场是有效的"）
- 纯历史回顾无前瞻预测
- 不可证伪的泛论（如"AI 会改变一切"）；认知求真型辩题允许无具体标的，但须含可检验的子命题
- 已形成强共识且无分歧空间的命题

## 三层编排架构

| 层级 | 机制 | 环境 | 隔离保证 |
|------|------|------|---------|
| **首选** | workflow.js 机器级编排 | Claude Code `execution` / Qoder CLI dynamic workflow API | 运行时隔离 |
| **降级** | 主 agent 用 Agent 工具 dispatch 自定义 subagent | Qoder IDE / 无 workflow 环境 | 平台上下文隔离 |
| **最后手段** | 主 agent 同上下文扮演五角色 | 任何环境 | 无隔离（须标注） |

**降级标注规则**：报告 frontmatter 必须含 `execution_mode: workflow | subagent_dispatch | inline_roleplay`。使用最后手段时，报告正文顶部须显式标注"⚠️ 同上下文扮演降级模式——角色隔离未保证，交锋质量可能受损"。

### 降级路径执行协议

**workflow.js 可用时**（Claude Code execution / Qoder CLI dynamic workflow）：
西塞罗（主 agent 扮演）按 `scripts/workflow.js` 定义的 10 phases 自动执行（EvidenceBase → ConceptAlignment → BlindPosition → Aggregate → CrossResponse → Aggregate → Defense → Aggregate → ClosingCross → Report），隔离由运行时保证。

**workflow.js 不可用时**（Qoder IDE / 无 workflow 环境）：
主 agent 按 [references/debate-protocol.md](references/debate-protocol.md) 的"降级路径执行方式"用 Agent 工具 dispatch 自定义 subagent。关键规则：
- R1/R2/R3/R4 每轮用一条消息并行 dispatch 多个 Agent 调用（实现 fan-out）
- 他方立论给原文不给摘要
- 引用机械校验由主 agent 在报告生成前执行
- 沉默角色在后续轮次跳过；R4 默认沉默制——仅开放战线非空的角色 dispatch

**最后手段**（无 subagent 能力）：
主 agent 同上下文扮演五角色，报告 frontmatter `execution_mode: inline_roleplay`，正文顶部须标注降级警告。此模式角色隔离未保证，交锋质量可能受损。

**双产出 + 自动润色**（所有执行模式）：
无论哪种执行模式，辩论结束后主 agent 产出两份文档——摘要版裁决书（≤1200 字，含辩论精华 + 三区 + 综合判断 + 结论产出）+ 全程实录汇总稿（辩论赛标准格式，含立场演化表 + 数据可靠性审查），然后自动调用 liam-polish skill 对两份文档做润色（消除 AI 味与翻译腔），全程不向用户提问。摘要版裁决书必须面向人读（禁止术语黑话，鼓励类比和具象化，允许结构化表格，普通人能直接读懂）。详见 [references/debate-protocol.md](references/debate-protocol.md) 的「报告生成」节与 [templates/report-template.md](templates/report-template.md) 的「双产出定义」「自动润色流程」「面向人读（硬约束）」「报告结构」节。

**交付物归档**（所有执行模式，R15 硬约束）：
双产出润色完成后，以润色稿为正本归档至 `docs/taixu-debate-reports/`（与 docs/hegel-reports 等五原子 skill 报告目录惯例一致），命名 `<topic_slug>-taixu-debate-report-<date>.md` / `<topic_slug>-taixu-debate-transcript-<date>.md`。topic_slug 为英文小写短横线 3-6 词，由西塞罗开辩时从辩题提炼（如 ai-semiconductor-capex-bubble）并写入 metadata.json。归档只留润色后正本，不留 -原文/-润色稿 双轨；过程文件写入本场运行目录 `runtime/debate/<date>-<topic_slug>-<run_id>/`（run_id 为开辩时刻 HHmmss，开辩时确定、全程不变；同一日期、同一话题的并行辩论也不得共用目录），仅保留 R1-R4 发言原文、metadata.json 等过程文件，交付物一律不留临时区。

## 辩论协议概述

**四轮结构**（详见 [references/debate-protocol.md](references/debate-protocol.md)）：

0. **Phase 0 证据底座**：西塞罗向用户询问研究预算（轻量/标准/深度），按命题类型调用研究工具，产出共享 EvidencePack 注入所有 R1 task prompt。投资决策型研究失败则 hard_stop；其他类型软降级并标注"⚠️ 无外部证据底座"
0.5. **Phase 0.5 概念对齐**（v0.8.0 新增）：西塞罗从 EvidencePack 提取 3-5 个核心概念并统一定义（口径边界），写入 `<run_dir>/concept_alignment.md`，与 EvidencePack 并列注入所有 R1 task prompt。主 agent 直接从 EvidencePack 提炼，不额外调用 LLM（仅 EvidencePack 为空时 1 次）。角色须使用统一定义立论；汇总 #1 时西塞罗事后检查概念使用偏差
1. **R1 盲立论**（parallel fan-out）：5 角色各自独立对辩题立论，互相不可见
2. **西塞罗汇总**：将 5 份立论合并为公开记录
3. **R2 交叉回应**（parallel fan-out）：每角色收到自己立论回放 + 他方立论原文，接力反驳须引用具体论点。贝叶斯可在此轮发起一次补充检索（≤3 次 WebSearch），结果追加公开记录供 R3 使用
4. **西塞罗汇总 #2**：将 R2 回应合并为公开记录；**标注全场盲区**（只标注不引导，注入 R3 task prompt——R4 终辩禁开新战线，R3 是最后一个能承接新维度的发言轮）
5. **R3 防御/修正**（parallel fan-out）：每角色收到自己 R1+R2 回放 + 他方 R2 原文，防御自身被攻击的论点或修正立场，须引用具体论点
6. **西塞罗汇总 #3**：合并 R3 为公开记录；为每个角色编译**开放战线清单**（他方 R3 的新攻击/新论证/修正后立场中与该角色相关的条目）
7. **R4 检验交锋与终辩声明**（默认沉默制）：仅开放战线非空的角色发言。前半段「检验交锋」逐条回应开放战线（只引用 R3）；后半段「终辩声明」给出终态立场 + 让步清单，**禁开新战线**。开放战线全空则跳过 R4 直接出报告

**发言五要素**：立场、核心论据、对他方论点的反驳（含引用）、沉默声明（无反驳则显式沉默）、**本轮小结**（≤60字白话，坚持/松动/转向了什么，因为什么）。R4 采用两段式格式（检验交锋 + 终辩声明），详见协议

**报告四组件**（详见 [templates/report-template.md](templates/report-template.md)）：
- 辩论精华：2-3 条穿透性引文
- 三区：共识区 / 分歧区 / 未决区
- 综合判断：西塞罗补充维度
- 结论产出：按命题类型分流（投资决策型给行动建议，选择决策型给结论与适用边界，认知求真型给采纳边界与验证跟踪）

## 角色注册表

5 个辩手角色 + 1 个主持人格定义见 [references/role-registry.md](references/role-registry.md)。角色快照见 [references/roles/](references/roles/)。

| 角色 | 来源 | 核心关切 |
|------|---------------|----------|
| 奥斯本（发散 · divergent） | osborn | 可能性空间是否充分打开？ |
| 黑格尔（收敛 · convergent） | hegel | 不确定项是否收敛？ |
| 贝叶斯（验证 · verifier） | bayes | 结论经得起外部数据打脸吗？ |
| 费曼（审查 · auditor） | feynman | 你在骗自己吗？ |
| 德博诺（归真 · integrator） | debono | 被否掉的东西有没有被忽略的价值？ |
| 西塞罗（主持 · host） | 编排层人格化 | 程序与实录是否守住？（非辩手，无 subagent 定义） |

## token 硬上限（R8）

单场全流程 token 消耗 ≤ 4.5× 单一强 prompt 基线（随研究预算档位浮动：轻量 4.3×、标准 4.5×、深度 5.0×）。超限硬终止。具体口径见 [references/debate-protocol.md](references/debate-protocol.md)。

## 验证实验

skill 投入使用前须经等 token 盲评实验验证增量价值。实验协议见 [references/validation-experiment.md](references/validation-experiment.md)。

## 不做的事

- 不替代太虚五转 pipeline（互补关系，非替代）
- 不做动态轮次判定——轮次数恒定为 4 轮，发言面动态由沉默机制与 R4 默认沉默制内生实现（多轮迭代辩论 v2 deferred）
- 不修改五原子 skill 的任何文件
- 不做对抗烈度控制（v2 deferred）
