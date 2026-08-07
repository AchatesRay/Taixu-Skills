---
name: taixu-pipeline
description: "Pipeline（串联五转）：osborn→hegel→bayes→feynman→debono 自动串联编排器。触发词: 一键五转, 跑五转, taixu-pipeline."
version: "1.4.0"
last_updated: "2026-07-24"
metadata:
  visibility: public
  risk: medium
  capabilities: [filesystem-read, filesystem-write, llm-call]
  kind: composed
  composition:
    final_output: debono
    manifest: references/pipeline-manifest.md
---

# 太虚五转自动串联编排器

一键串联 osborn→hegel→bayes→feynman→debono，保证完整五转流程不被嵌套降级污染。

## 使用方式

触发词：`太虚五转`、`一键五转`，`taixu-pipeline`

需要提供 `input.topic`（分析主题，如"太虚五转自动串联 + 防 Hegel 嵌套降级"）。

可选参数：
- `input.type` — 显式指定问题类型（deterministic / non_deterministic / mixed），透传给 osborn 作为最高优先级信号
- `--steps osborn,hegel,bayes` — 仅执行指定步骤子集
- 每个步骤后设 CHECKPOINT，用户可选择继续、跳过或终止

## 前置路由（brainstorm/ce-brainstorm 已废弃，能力归入 pipeline）

ce-brainstorm 和 brainstorm 已完全废弃，其能力分散到太虚五转各层。当用户使用以下触发词时，pipeline 执行前置路由：

| 用户说 | 路由逻辑 |
|--------|---------|
| "brainstorm" / "头脑风暴" / "先设计" | Step 0 scope assessment → 主题清晰且需求明确 → quick exit（hegel --spec-only 或 liam-plan）；主题清晰但方向待探索 → osborn P0；主题模糊 → osborn P0-clarify |
| "出方案" / "规格化" / "写spec" | hegel --spec-only（快速规格化，跳过完整收敛循环） |
| "从太虚产出写需求" | hegel --lens specification-bridge（从五转产出转化为 requirements doc） |

### Step 0 — Scope Assessment（吸收自 ce-brainstorm Phase 0.2-0.3）

pipeline 入口执行 scope assessment，判定工作量和路由：

- **Lightweight**（小、边界清晰，低模糊度）→ 快速路由：osborn P0 简化发散 → hegel --spec-only → 结束
- **Standard**（正常功能、有些决策要做）→ 完整五转
- **Deep**（跨领域、战略性，高模糊度）→ 完整五转 + bayes 异构验证

路由判定由 osborn P0-clarify 的清晰度测试自动完成：能用一句话说清主题 + 识别 ≥3 个维度轴则直接发散，否则先做 Q&A 澄清。

### Quick Exit（吸收自 ce-brainstorm Phase 0.2）

当用户需求已明确（有验收标准、有可参考模式，行为已描述清楚、scope 有约束），不需要发散：
- 需要规格化 → hegel --spec-only
- 需要执行计划 → 建议直接用 liam-plan
- 仅需确认理解 → 简要回复，不启动 pipeline

## 组合概览

1. **osborn** (skill: osborn) — 发散阶段，产出 idea-pool.md
2. **hegel** (skill: hegel --standalone) — 收敛阶段，⚠️ 硬编码传入 --standalone 跳过内嵌验证
3. **bayes** (skill: bayes) — 验证阶段，使用独立 lens 完整能力
4. **feynman** (skill: feynman) — 审查阶段，使用独立 lens 完整能力
5. **debono** (skill — debono) — 归真阶段，on_failure: skip，可选。debono 完成后**自动触发五转综合总结**，V2.2 强制，写入 `docs/reports/{topic-slug}-taixu-summary-{date}.md`
6. **执行契约补齐 + plan 桥接**（收尾步骤）— 检查 hegel spec，若走了 specification-bridge是否含"执行契约附录"，Constraints/Boundaries/Pause if，见 hegel `references/lens-specification-bridge.md`；缺则从五转产出中派生补齐，标注来源 finding 或 `[假设，可推翻]`。然后明示用户：可进入 liam-plan，spec 已就绪，走 0.3 carry forward 直接规划路径，零追问。

## 方法论映射

两大策略（确定性/非确定性）→ 六要素 → 五转的多对多映射。详见 `references/methodology-mapping.md`。

## 防嵌套机制

- hegel step 的 `args.standalone: true` 在 composition block 中硬编码，配置级强制
- hegel SKILL.md §6.1/§7.1 检测到 --standalone 时跳过 bayes/feynman 内嵌调用
- 独立调用 `/hegel` 时不带此参数，行为完全不变（向后兼容）

## 审查与验证阶段强制条款（D11/D12 修复，2026-07-19）

受控 A/B 实验（runtime/taixu-ab-test/2026-07-18/）发现 2.0 在 D12，审查检出力相对 1.0 退坡 -2.5、D11，验证退坡 -1.0。根因在编排层而非 skill 本体，修复如下：

1. **feynman 盲审不可降级**：时间预算紧不构成降级理由。仅当 subagent 工具调用本身失败时才允许降级为主 Agent 自审，且降级必须在 feynman 报告头部显式标注 `review_mode: self (fallback)`。
2. **宽松度自查**：盲审结果 0 veto 且合规项 ≥5/6 时，主 Agent 必须列出 3 条「最可能被否决的断言」逐条自证，写入 feynman 报告附录；自证不通过的断言按 veto 处理。
3. **深挖优先**：bayes 报告中所有 ⚠️[待验证] 项在进入 debono 前必须完成 Bayes 联动深挖（references/depth-engine-principles.md），禁止带未深挖的待验证项进入归真阶段。
4. **bayes 精确数据源约束** —`refuted` 判定必须附 file:line / 脚本输出 / 台账定位；估算值只能支撑 `unverified` 或 `partial`，不得用于推翻断言。

## CHECKPOINT 协议

每个 step 完成后暂停，展示信号、时间预算，相变检测、problem_type 路由。详见 `references/checkpoint-protocol.md`。

## UltraPlan 并行模式

可选增强，支持 osborn 维度并行 fan-out + bayes 异构验证 fan-out。详见 `references/ultraplan-parallel.md`。

## --steps 子集执行

支持 `--steps hegel,bayes` 语法：
- 仅执行指定步骤及其依赖
- 未指定步骤的产出物需已存在（从上次运行恢复）
- 若依赖缺失且无法恢复，报错并提示补全

## 注意

- 所有原子 skill 仍可独立使用，本 composed skill 是可选上层编排
- debono 为 soft_depends_on + on_failure: skip，即使 feynman 失败也不阻断管线
- debono 完成后自动触发五转综合总结（debono V2.2 内置），生成 `docs/reports/{topic}-taixu-summary-{date}.md`，包含全程叙事、关键转折，核心洞察、元认知收获。此为强制步骤，不可跳过
- 全程产出物写入 `docs/hegel-reports/` 或 `docs/osborn-pools/`，综合总结写入 `docs/reports/`，按日期命名
- pipeline 全部 step 完成后（或用户终止后），将各 step 的执行时间汇总追加到 debono 综合总结末尾，格式：

  ```markdown
  ## 时间日志
  | Step | 耗时 | Budget | Typical | 偏离 | 累计% |
  |------|------|--------|---------|------|-------|
  | osborn | 8min | 8min | 8min | 1.0x | 18% |
  | hegel | 12min | 8min | 8min | 1.5x | 45% |
  | bayes | 10min | 10min | 10min | 1.0x | 68% |
  | feynman | 15min | 10min | 10min | 1.5x | 102% 🔴 |
  | debono | 6min | 8min | 8min | 0.75x | 116% 🔴 |
  | **合计** | **51min** | **44min** | **44min** | **1.16x** | — |

  ## 相变信号汇总
  | Step | 信号 | 值 | 动作 |
  |------|------|-----|------|
  | hegel | terminal_status | converged | — |
  | bayes | refuted_count | 3 | 🔴 highlight |
  | feynman | veto_count | 2 | 🔴 highlight |
  | **相变簇** | **2 个 highlight** | — | **系统性偏差提示** |
  ```

  时间日志用于 liam-retro 分析和 typical 值校准（≥10 次后用实际中位数替换初始估计值）。预算列用于评估 problem_type → budget 映射的准确性，≥3 次同类型后校准预算值。相变信号汇总用于识别系统性认知偏差。
