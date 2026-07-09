---
name: hegel
display_name: "太虚二转 · 澄源（黑格尔）"
visibility: public
description: 迭代收敛（太虚二转·澄源）：链式分析自动循环至稳定。触发词: 收敛, 黑格尔, hegel.
  Iterative convergence (太虚二转·澄源): chain analyses into auto-cycling pipeline until stable. Use when
  user says "收敛", "黑格尔", "hegel", "帮我盘一下".
version: 2.4.0
last_updated: 2026-07-04
author: fengling
status: active
tags: [hegel, convergence, bayes, feynman, iterative-analysis, lens]
triggers:
  - hegel
  - 黑格尔
  - 太虚二转
  - 澄源
  - 收敛
  - 收敛一下
  - 深度分析
  - 收敛分析
  - 帮我盘一下
  - 全面审查
  - 迭代分析
  - /hegel
dependencies:
  skills:
    - bayes               # S3 calibrate / S5 verify
    - feynman             # S4 偏差审查 / S5 R2
  optional_skills:
    - debono              # S7 归真对冲检查（防批判致死）
    - code-review-skill   # code lens 快速路径
    - deepen              # S5 深化
    - deep-research       # S5 epistemic 数据收集
metadata:
  visibility: public
---

# Hegel 黑格尔收敛

## 概述

单次分析天然有盲区——迭代收敛把多种分析方法串成自动循环管线，每轮送入校准、挑战、深化三个环节，直到不确定项稳定。校准对齐事实，挑战引入对立视角攻击结论，深化把存活结论往下挖。最终输出收敛报告，标注每条结论的置信度和剩余不确定项。

太虚五转第二转：澄源（收敛）。浊水静置，杂质沉淀，清水浮现。

## 1. 定位

**解决什么**：单次分析各自有盲区，发现看不到深层逻辑、验证易陷入自证、偏差检查不产出新发现。本 skill 将多种分析方法编排为**自动迭代管线**，通过三维架构实现跨领域的认知收敛。

**三维架构**：

```
            deterministic       epistemic          ontological
           ┌────────────────┬───────────────┬───────────────┐
  P1 发现  │ 提取断言       │ 提取断言      │ 提取断言       │
  P2 校准  │ 硬验证→二值   │ 软验证→区间   │ 概率分布→接受  │
  P3 偏差  │ F1 假设验证    │ F2+F5 框架    │ F2+F3 精确化   │
  P4 深化  │ 根因追溯       │ 证据扩展      │ 情景+鲁棒性    │
  P5 收敛  │ 二值判定       │ 区间窄化      │ 稳定性检查     │
  P6 报告  │            统一输出                            │
           └────────────────┴───────────────┴───────────────┘
                        领域透镜: code / investment / prd-review / ideation / architecture-decision / retrospective / specification-bridge
```

- **原则骨架（P1-P6）**：认知纪律链，不随领域变化
- **领域透镜（lens）**：定义"看什么"——分类枚举、skill 路由、偏差检查项、深化维度
- **不确定性路由**：定义"怎么想"——按 uncertainty_type 选推理策略和收敛标准

**不做什么**：不替代子 skill 的独立使用（简单任务直接用单个 skill）。

---

## 2. S0-S7 管线

```
S0 前置检查 + lens 校验 + 初始化 → hegel-state.json
S1 定界 → scope（边界+维度+约束+预算）→ scope-validate.py
S2 发现 → claims[]（Toulmin 五型断言提取，lens 快速路径可跳过）
S2.5 rigor gate → 断言质量预筛（6 维 rigor probes）
S3 校准 → findings[]（bayes mode:calibrate + uncertainty_type 判定）→ gate_check
┌─ S4 挑战 → feynman_flags[]（feynman --lens 适配 F1-F6）→ gate_check + emergent 升级判定
│  S5 深化 → confidence 更新（lens 路由 + bayes mode:verify）→ gate_check
│  S6 收敛判定 → check-convergence.py → exit code
└─ exit=1（未收敛）→ 回到 S4
exit=0|2 → S7 报告 + 漂移检查
```

S4→S5→S6 为内循环（`current_round` 在 S4 入口 +1）。各步骤职责详见 §3-§11。

---

## 3. S0 — 前置检查 & 初始化

### 3.1 前置依赖检查

```bash
SKILL_DIR=$(dirname "$0")/..  # hegel skill 目录
python3 $SKILL_DIR/scripts/preflight-check.py --lens {lens}
```

退出码 0 = 就绪，1 = 缺失（阻塞，输出安装指引）。

### 3.2 Lens 校验

加载 `references/lens-{name}.md`，执行 L1-L7 结构校验（7 个 section 齐全）。缺失 section 阻塞管线。

### 3.3 初始化状态文件

```bash
python3 $SKILL_DIR/scripts/init-state.py \
  --target "{用户输入}" \
  --target-type {推断类型} \
  --lens {lens} \
  --problem-type {problem_type} \
  --max-rounds {N} \
  --output hegel-state.json
# --problem-type 可选，从 pipeline 传入（deterministic / non_deterministic / mixed / pending）
```

产出空骨架 state.json。Schema 见 `references/state-schema.md`。

### 3.4 确认摘要

输出：目标、lens、模式、收敛阈值（含 hard_cap）、最大轮次。自动进入 S1。

---

## 4. S1 — 定界

### 4.1 scope 结构

```yaml
scope:
  schema_version: 1
  revision: 1
  system_type: "deterministic | non_deterministic | mixed"
  system_type_rationale: "≥20 字说明"
  dimensions: [{id, name, description, weight, source, active}]
  success_criteria: [{id, description, type, params, linked_dimensions}]
  constraints:
    axioms: [{id, description, violation_action, check_type, check_rule, semantic_prompt}]
    parameters: [{id, name, value, description, violation_action, check_type, check_rule, semantic_prompt}]
  budget: {complexity, max_safety_valve_rounds, estimated_passes}
  provenance: {lens_id, user_overrides, pre_scan_inferred, auto_fill_ratio}
```

**problem_type 先验**：若 pipeline 传入 `problem_type`（非 pending），S1 将其作为 `scope.system_type` 的先验值——LLM 仍需验证并填写 `system_type_rationale`，但起点从该先验开始。若 `problem_type` 为 `pending` 或未传入，S1 按当前行为自行判定。

### 4.2 四层输入源（优先级高→低）

1. 用户 CLI 参数
2. pipeline 传入的 problem_type（作为 system_type 先验）
3. Lens 模板默认值
4. LLM 预扫描推断

### 4.3 Scope 校验

```bash
python3 $SKILL_DIR/scripts/scope-validate.py scope.json
```

V1-V10 校验规则。退出码：0=通过，1=错误，2=仅告警。

---

## 5. S2 — 发现（断言提取）

### 5.1 通用路径

调用断言提取提示词（`prompts/claim-extract-*.md`），输入 target_text + lens + scope。

产出 `claims[]`，每条 claim 含 Toulmin 五型分类 + "2+1" 不确定性标记。

详见 `hegel/prompts/claim-extract-*.md`。

### 5.2 Lens 快速路径

当 lens 支持快速路径时（如 code lens，target_type 为 file/diff/pr），可跳过断言提取步骤，由领域 skill 直接产出 findings[]。

此时：
- S1 scope 从 lens 模板自动填充
- claims[] 为空，claim_finding_map 为空
- findings[].origin = `structural_discovery`

### 5.3 Architecture target_type

当 `target_type == "architecture"` 时，执行架构专用协议。详见 [references/architecture-target-type.md](references/architecture-target-type.md)（物化输入、scope 维度、发现分类、深化策略、禁止行为）。

### 5.4 质量检查

| 检查 | 标准 | 失败时 |
|------|------|--------|
| 提取率 | claims 数 ≥ 1 | gate escalate |
| 平均提取置信度 | ≥ 0.6 | 触发退化方案 |
| 类型覆盖 | ≥ 2 种 type | warning |
| 确认覆盖率 | confirm_no_change 占比 ≥ 15% | warning: 分析框架可能存在确认偏差（预设「原方案有问题」），未检验零假设 |

### 5.5 S2.5 — Rigor Gate（断言质量预筛）

S2 提取后、S3 校准前，对每条 claim 执行 6 维 rigor probes 质量预筛（evidence/specificity/counterfactual/simplicity(剃刀)/attachment/durability，各 0-2 分）。≥0.6 通过、≥0.3 标记、<0.3 淘汰。详见 [references/rigor-gate.md](references/rigor-gate.md)。

**能力来源**：rigor gate 吸收了已废弃的 ce-brainstorm `product-pressure-test.md`（产品级压力测试）的 5 个维度（evidence/specificity/counterfactual/attachment/durability），hegel 额外贡献 simplicity（奥卡姆剃刀）作为第 6 维。原 ce-brainstorm 的压力测试本质上是对断言的收敛行为，与 rigor gate 天然同构。详见 [references/product-pressure-test.md](references/product-pressure-test.md)。

---

## 6. S3 — 校准

### 6.1 执行

若传入 `--standalone` 参数，**跳过本步骤**，直接产出空 findings[] 并标记 `skipped_by: standalone`，进入 S4。

否则，调用 bayes `mode:calibrate`，遍历 claims[] 产出 findings[]。

### 6.2 核心产出

- 每条 finding 的 `uncertainty_type`（deterministic / epistemic / ontological）
- 初始 confidence
- `claim_finding_map` 双向映射

### 6.3 claim→finding 映射

默认 1:1；多条 claim 指向同一事实→合并（claim_refs[]）；confidence_extractable < 0.4→过滤；零 findings→gate escalate；finding 继承源 claim 的 `claim_category`（合并取最高优先级：bug > design_gap > missing_feature > confirm_no_change）。

### 6.4 Status 转换

S3/S5 每次更新 confidence 后立即应用：≥0.85（deterministic）→confirmed；≤0.15→dismissed；epistemic CI<阈值→confirmed；ontological 连续2轮 delta<0.05→confirmed。反向转换仅在 S4 feynman 惩罚时。

### 6.5 Gate check

S3 完成后执行 gate_check（见 §9）。

---

## 7. S4 — 挑战（偏差审查）

### 7.1 执行

若传入 `--standalone` 参数，**跳过本步骤**，直接标记所有 findings 的 `feynman_flags` 为 `{skipped_by: standalone}`，进入 S5。

否则，调用 feynman，`--input findings --lens {lens}`。

逐条 finding 执行 P1-P6 审查，F1-F6 检查问题从 lens 文件 §5 动态加载。

### 7.2 标记处理

- 每条 finding 附加 `feynman_flags`
- 惩罚规则从 lens 文件 §5 `penalty_rules` 加载（默认：F1+F5 同时 ❌ → confidence -= 0.2，回退为 uncertain）
- 新发现 → 追加到 findings[]，origin=structural_discovery

### 7.3 先验重置信号

F1（未验证假设）或 F5（自证清白）触发 ❌ 时，向 S5 bayes 发送 `prior_source: feynman_reset` 信号。

### 7.4 Emergent 约束

分析中发现新约束 → 写入 `emergent_constraints[]`，status=cooling → 下一轮 feynman 审查后决定 promote 或 dismiss。

### 7.5 Gate check

S4 完成后执行 gate_check + emergent 升级判定。

---

## 8. S5 — 深化

`--standalone` 时跳过本步骤。否则仅对 `status=uncertain` 的 findings 执行深挖 + bayes 验证。深化策略路由（D1删除测试/D2因果追溯/D3边界探测/D4复现验证）按 claim_type 选择，按 uncertainty_type 路由 bayes 验证方式。含先验重置、snap-back 检测、CI 产出、新增 finding、重分类等规则。详见 [references/s5-deepening-and-gate.md](references/s5-deepening-and-gate.md)。

---

## 9. 底线门禁系统

每步写完 state.json 后执行 gate_check()。三种约束（Axiom 不可变→halt / Parameter 阈值可调→warn|escalate / Emergent 运行时发现→冷却升级），五级响应（continue/warn/escalate/reassess_scope/halt）。详见 [references/s5-deepening-and-gate.md](references/s5-deepening-and-gate.md)。

---

## 10. S6 — 收敛判定

### 10.1 执行

```bash
python3 $SKILL_DIR/scripts/check-convergence.py hegel-state.json
```

退出码：0=已收敛，1=未收敛，2=安全阀截断。

### 10.2 六项收敛条件（AND 逻辑）

| 条件 | 说明 |
|------|------|
| C1 | 置信度稳定（delta 按类型分化：deterministic=0.03，其余=0.05） |
| C2 | 无新增 findings |
| C3 | 无翻转 + 伪稳定检测（仅 epistemic） |
| C4 | 类型感知收敛（deterministic→二值，epistemic→CI<0.3，ontological→稳定 2 轮） |
| C5 | 无 unresolved escalated 约束违规 |
| C6 | 相变检测（置信度跳变≥0.3 / 状态翻转 / CI宽度突变≥50%）—仅记录，不阻塞收敛 |

详见 `references/convergence-criteria.md`。

### 10.3 安全阀

```
max_rounds = base + onto_bonus(1 if any ontological else 0)
hard_cap = lens 级参数（从 lens frontmatter 加载）
```

### 10.4 未收敛时

输出进度摘要，回到 S4（current_round +1）。

---

## 11. S7 — 报告 + 漂移检查

### 11.1 漂移检查

对比 S1 scope 与实际分析轨迹，检测边界漂移。

### 11.2 黄帽对冲检查（可选）

收敛完成后、报告生成前，执行正面价值扫描，防止「批判致死」。

**触发条件**（满足任一即触发）：
- 收敛结果中 dismissed 数 / total 数 > 0.7（超过 70% 的发现被排除）
- 所有 finding 的终态 confidence 中位数 < 0.3
- 用户显式传入 `--debono` 参数

**执行**：调用 debono skill（可选依赖），输入为 S1 scope + findings[] 全量（含 dismissed）。

**产出**：
- `debono_scan`：存活论证 + 四维价值扫描（用户价值 / 技术可行性 / 战略对齐 / 机会成本）
- `counterbalance_verdict`：是否存在「被批判掩盖的真实价值」

**不触发时**：`debono_scan = null`，不影响报告。

### 11.3 八种终态

converged / converged_with_blind_spots / converged_with_counterbalance / truncated / truncated_with_blind_spots / aborted / initialized / in_progress。详见 [references/report-format.md](references/report-format.md)。

### 11.4 报告格式与 Severity 耦合

报告必须含 YAML frontmatter（`signals.terminal_status` + `signals.system_type`）。含收敛摘要、确认问题（含 effective_severity）、零假设检验、已排除问题、归真对冲、边界漂移、审计日志。severity 须考虑 confidence（<0.6 降为 major，<0.4 降为 minor）。详见 [references/report-format.md](references/report-format.md)。

报告路径：`docs/hegel-reports/{target_slug}-hegel-{date}.md`

---

## 12. 不确定性路由速查

两阶段分类（S2 提取→S3 校准），按类型路由校准/偏差/深化/收敛策略，含 problem_type 适配。详见 [references/s5-deepening-and-gate.md](references/s5-deepening-and-gate.md)。

---

## 13. 跨窗口恢复

读取 hegel-state.json，检查 current_pass/current_round，从当前步骤开头继续，findings 和 pass_log 保留已有数据。

---

## 14. 路由索引

Lens: `references/lens-{name}.md`（code/investment/prd-review/ideation/architecture-decision/retrospective/specification-bridge[`--spec-only`]）
状态: `references/state-schema.md` | 收敛: `references/convergence-criteria.md` | 报告: `references/report-format.md`
脚本: `scripts/{init-state,scope-validate,check-convergence}.py` | 提示词: `prompts/claim-extract-*.md`

---

## 15. 调用方式

```bash
# 代码审查（默认 code lens）
/hegel src/core/parser.ts

# 投资分析
/hegel --lens investment --target "APP thesis" --target-type thesis

# 架构决策分析
/hegel --lens architecture-decision --target "架构方案.md" --target-type adr

# 独立模式（taixu-pipeline 专用，跳过 S3/S4/S5 内嵌调用）
/hegel --standalone --lens ideation --target idea-pool.md --problem-type non_deterministic

# --spec-only 快速规格化（跳过 S3-S5，直接生成 requirements doc）
/hegel --lens specification-bridge --spec-only "优化周报输出格式"
```

#### --spec-only 快速规格化

配合 `--lens specification-bridge` 使用，跳过完整收敛循环（S3-S5），直接从用户输入生成 requirements doc。适用于快速对齐场景（3-8min vs 完整模式 10-30min）。

交互规则遵循 osborn P0-clarify 的渐进式 Q&A。详见 `references/lens-specification-bridge.md` §--spec-only。

---

## 16. 设计决策

详见 [references/design-decisions.md](references/design-decisions.md)（D1-D12 共 12 条历史决策记录）。
