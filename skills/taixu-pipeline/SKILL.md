---
name: taixu-pipeline
description: "太虚五转连招：osborn→hegel→bayes→feynman→debono 自动串联编排器。触发词: 一键五转, 跑五转, taixu-pipeline."
version: "1.1.0"
last_updated: "2026-07-04"
kind: composed
metadata:
  visibility: public
  risk: medium
  capabilities: [filesystem-read, filesystem-write, llm-call]
composition:
  final_output: debono
  steps:
    - id: osborn
      kind: skill
      skill: osborn
      args:
        topic: "{{ input.topic }}"
        type: "{{ input.type }}"
      checkpoint: true

    - id: hegel
      kind: skill
      skill: hegel
      depends_on: [osborn]
      args:
        standalone: true
        lens: ideation
        target: "{{ steps.osborn.output.idea_pool_path }}"
        target_type: idea_pool
        problem_type: "{{ steps.osborn.output.problem_type }}"
      checkpoint: true

    - id: bayes
      kind: skill
      skill: bayes
      depends_on: [hegel]
      args:
        input: "{{ steps.hegel.output.report_path }}"
        problem_type: "{{ steps.osborn.output.problem_type }}"
      checkpoint: true

    - id: feynman
      kind: skill
      skill: feynman
      depends_on: [bayes]
      args:
        input: "{{ steps.bayes.output.report_path }}"
        problem_type: "{{ steps.osborn.output.problem_type }}"
      checkpoint: true

    - id: debono
      kind: skill
      skill: debono
      depends_on: [feynman]
      soft_depends_on: [feynman]
      args:
        input: "{{ steps.feynman.output.report_path }}"
        problem_type: "{{ steps.osborn.output.problem_type }}"
        bayes_report_path: "{{ steps.bayes.output.report_path }}"
      on_failure: skip
      checkpoint: true
  time_baselines:
    # 初始估计值（基于 standalone 模式），使用 ≥10 次后用实际中位数替换
    osborn: 8min
    hegel: 8min    # standalone 模式（跳过 S3/S4/S5）
    bayes: 10min
    feynman: 10min
    debono: 8min
  checkpoint_signals:
    hegel: [terminal_status, system_type]
    feynman: [veto_count]
  # 方向3：相变信号汇总（各转内部的状态突变检测）
  phase_transition_signals:
    hegel:
      - field: signals.terminal_status
        transition: "converged → diverged/truncated"
        action: warn
        description: "收敛状态突变——从未收敛变为发散或截断"
      - field: signals.system_type
        transition: "any change from osborn problem_type"
        action: warn
        description: "系统类型与问题类型不一致"
    bayes:
      - field: signals.refuted_count
        threshold: ">=2"
        action: highlight
        description: "多个预测被推翻——方案假设可能有系统性偏差"
      - field: signals.blindspot_count
        threshold: ">=3"
        action: highlight
        description: "盲区数量高——认知覆盖不足"
    feynman:
      - field: signals.truth_drift
        transition: "none → detected"
        action: highlight
        description: "真相漂移——目标已被替换为代理指标"
      - field: signals.veto_count
        threshold: ">=1"
        action: highlight
        description: "存在阻塞级否决——进入 Execute 前必须修复"
    debono:
      - field: signals.survival_rate
        threshold: "<0.3"
        action: warn
        description: "存活概率低——命题可能确实无价值"
  # 方向5：按问题类型分配时间预算（初始估计值，需 ≥3 次实战后校准）
  time_budget:
    deterministic:
      osborn: 6min   # 第一性分解，想法量少
      hegel: 6min    # 严格收敛，期望单一答案
      bayes: 8min    # 事实验证
      feynman: 8min  # P1 加严
      debono: 6min   # 形式逻辑聚焦
      total: 34min
    non_deterministic:
      osborn: 10min  # 量级驱动，想法量大
      hegel: 10min   # 允许多条路径
      bayes: 12min   # 概率评估
      feynman: 12min # P2 不确定性标注
      debono: 10min  # 概率量化
      total: 54min
    mixed:
      osborn: 8min
      hegel: 8min
      bayes: 10min
      feynman: 10min
      debono: 8min
      total: 44min
    pending:
      inherit: mixed  # 默认使用 mixed 预算
  # UltraPlan: 可选并行模式（默认线性串联，非破坏性）
  parallel:
    enabled: false  # 默认关闭，需显式启用: --parallel
    fanout:
      osborn:
        strategy: focus-dimensions  # 按维度轴 fan-out，各实例聚焦不同维度
        max_parallel: 3  # 最多 3 个并行 osborn 实例
        merge: concatenate  # 合并产出: 拼接 idea-pool
      bayes:
        strategy: verify-mode  # 按验证模式 fan-out，异构模型独立验证
        max_parallel: 2  # L2 双模型并行（Claude + Qwen）
        merge: cross-validate  # 合并产出: 交叉验证后取一致结论
    critic:
      enabled: true  # fan-out 产出后自动触发 critic 综合步骤
      step: hegel  # critic 由 hegel 承担: 合并收敛多个 fan-out 产出
---

# 太虚五转自动串联编排器

一键串联 osborn→hegel→bayes→feynman→debono，保证完整五转流程不被嵌套降级污染。

## 使用方式

触发词：`太虚五转`、`一键五转`、`taixu-pipeline`

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

- **Lightweight**（小、边界清晰、低模糊度）→ 快速路由：osborn P0 简化发散 → hegel --spec-only → 结束
- **Standard**（正常功能、有些决策要做）→ 完整五转
- **Deep**（跨领域、战略性、高模糊度）→ 完整五转 + bayes 异构验证

路由判定由 osborn P0-clarify 的清晰度测试自动完成：能用一句话说清主题 + 识别 ≥3 个维度轴则直接发散，否则先做 Q&A 澄清。

### Quick Exit（吸收自 ce-brainstorm Phase 0.2）

当用户需求已明确（有验收标准、有可参考模式、行为已描述清楚、scope 有约束），不需要发散：
- 需要规格化 → hegel --spec-only
- 需要执行计划 → 建议直接用 liam-plan
- 仅需确认理解 → 简要回复，不启动 pipeline

## 组合概览

1. **osborn** (skill: osborn) — 发散阶段，产出 idea-pool.md
2. **hegel** (skill: hegel --standalone) — 收敛阶段，⚠️ 硬编码传入 --standalone 跳过内嵌验证
3. **bayes** (skill: bayes) — 验证阶段，使用独立 lens 完整能力
4. **feynman** (skill: feynman) — 审查阶段，使用独立 lens 完整能力
5. **debono** (skill: debono) — 归真阶段，on_failure: skip（可选）。debono 完成后**自动触发五转综合总结**（V2.2 强制），写入 `docs/reports/{topic-slug}-taixu-summary-{date}.md`

## 方法论映射：两大策略 → 六要素 → 五转

太虚五转不是随意拼接的五个步骤，而是用户核心方法论的工程化落地。方法论将问题分为两类，每类三个要素，共六要素，分布在五转中实现。

### 两大策略

| 策略 | 适用问题 | 三要素 | 核心思想 |
|------|---------|--------|----------|
| 确定性策略 | 有唯一正确答案 | 第一性原理 + 贝叶斯公式 + 剃刀法则 | 分解到基础 → 逻辑推导 → 剃掉多余假设 |
| 非确定性策略 | 涉及人/市场/未来 | 有界贝叶斯 + 相变识别 + 平均时间最优 | 承认认知有限 → 识别状态突变 → 追求时间平均最优 |

### 六要素 → 五转映射

| 要素 | 所属策略 | 在五转中的体现 | 方向落地 |
|------|---------|---------------|----------|
| 第一性原理 | 确定性 | osborn P0.2 第一性分解：识别基本实体 → 列出公理假设 → 标注未知项 | 方向2 |
| 贝叶斯公式 | 确定性 | bayes 预测→验证→更新 + debono 贝叶斯概率量化（bayes 联动先验） | 方向4 |
| 剃刀法则 | 确定性 | hegel 收敛到最简解释 + feynman P1 假设必须有形式化验证 | 原有 |
| 有界贝叶斯 | 非确定性 | bayes 按不确定性类型选深挖角度 + debono 存活条件区间概率 | 方向4 |
| 相变识别 | 非确定性 | hegel C4 收敛阈值检测状态突变 + feynman P2 真相漂移检测 | 原有 |
| 平均时间最优 | 非确定性 | osborn 量级驱动（先追求数量，质量从数量里浮现）+ pipeline 时间追踪 | 方向5 |

### 策略路由

problem_type（方向1）是两大策略的切换开关：
- `deterministic` → 确定性策略路径：osborn 第一性分解 → hegel 严格收敛 → bayes 事实验证 → feynman P1 加严 → debono 形式逻辑聚焦
- `non_deterministic` → 非确定性策略路径：osborn 量级发散 → hegel 允许多条路径 → bayes 概率评估 → feynman P2 不确定性标注 → debono 概率量化
- `mixed` → 混合路径：按子问题分别走两条策略
- `pending` → 默认行为（LLM 自行判定）

### 要素与 Skill 的多对多关系

六要素不与五转一一对应，而是多对多映射：

```
第一性原理 ──→ osborn
贝叶斯公式 ──→ bayes + debono
剃刀法则   ──→ hegel + feynman
有界贝叶斯 ──→ bayes + debono
相变识别   ──→ hegel + feynman
平均时间最优──→ osborn + pipeline
```

每个 Skill 实现多个要素，每个要素分布在多个 Skill 中。五转的顺序（发散→收敛→验证→审查→归真）确保每个要素在正确的阶段被调用。

## 防嵌套机制

- hegel step 的 `args.standalone: true` 在 composition block 中硬编码，配置级强制
- hegel SKILL.md §6.1/§7.1 检测到 --standalone 时跳过 bayes/feynman 内嵌调用
- 独立调用 `/hegel` 时不带此参数，行为完全不变（向后兼容）

## CHECKPOINT 协议

每个 step 完成后暂停，向用户展示：

```
📊 Step: {step_id} | ⏱ {elapsed}min (budget: {step_budget}min | cumulative: {cumulative_min}min / {total_budget}min = {pct}%)
🔴 Signals: {signal_key}={signal_value} ...
🔴 Phase Transitions: {transition_description}    ← 仅当相变信号触发时显示
⚠️ 偏离 typical >2x        ← 仅当 elapsed / typical > 2 时显示
⚠️ 预算超支: {pct}% > 80%     ← 仅当累计预算消耗 >80% 时显示
   产出物: {report_path}
   下一步: {next_step_id}
   选项: 继续 / 跳过 / 终止 / 重跑
```

### 相变信号检测（方向 3）

每个 step 完成后，从产出物的 YAML frontmatter 中提取 `signals` 字段，与 `phase_transition_signals` 配置匹配：

1. **提取信号**：读取 step report 的 `signals` 字段
2. **匹配规则**：检查 `phase_transition_signals[step_id]` 中定义的每个规则
3. **触发动作**：
   - `action: warn` → 在 CHECKPOINT 中以 🟡 标注
   - `action: highlight` → 在 CHECKPOINT 中以 🔴 标注
4. **累积追踪**：相变信号在 pipeline 全程累积，debono 综合总结中汇总展示

**信号来源**：
- hegel → `signals.terminal_status`, `signals.system_type`
- bayes → `signals.refuted_count`, `signals.blindspot_count`
- feynman → `signals.veto_count`, `signals.truth_drift`
- debono → `signals.survival_rate`

**相变累积效应**：当 ≥2 个 step 触发 `action: highlight` 级相变信号时，pipeline 在最终总结中标注 `phase_transition_cluster`，提示用户关注系统性偏差。

### 全局时间预算（方向 5）

pipeline 启动时根据 problem_type 选择对应 `time_budget` 配置，全程追踪预算消耗：

1. **预算分配**：`problem_type` → `time_budget[problem_type]` → 各 step 的 `step_budget`
2. **累计追踪**：每 step 结束后 `cumulative_min += elapsed_min`，计算 `pct = cumulative_min / total_budget * 100`
3. **预警阈值**：
   - `pct > 80%` → 🟡 显示预算预警
   - `pct > 100%` → 🔴 显示预算超支
4. **不强制中断**：超预算时仅预警，不自动终止 pipeline（认知质量优先于速度）
5. **时间日志增强**：最终时间日志增加预算列

**problem_type 未确定时**：使用 `mixed` 预算配置（最通用）。osborn P0 判定 problem_type 后，若与 `mixed` 不同，从下一个 step 开始切换到对应预算配置。

### 时间追踪

每个 step 开始前和结束后各执行一次 `date '+%s'` 记录 epoch 时间戳，差值转换为分钟。⚠️ 时间追踪依赖 shell 环境可用；若 LLM 遗漏 `date` 执行，追踪静默失败（无报错，缺数据）。

```bash
step_start=$(date '+%s')
# ... 执行 step ...
step_end=$(date '+%s')
elapsed_min=$(( (step_end - step_start) / 60 ))
```

typical 基准值见 frontmatter `time_baselines`。初始值为估计值（基于 standalone 模式），使用 ≥10 次后用实际中位数替换。

### 信号展示

从 step 产出物（report 文件）的 YAML frontmatter 中提取 `signals` 字段，按 `checkpoint_signals` 配置过滤后展示。

高亮规则：
- hegel `terminal_status` 值 ≠ "converged" → 🔴 高亮
- hegel `system_type` 与 osborn `problem_type` 不一致 → 🔴 高亮
- feynman `veto_count` 值 ≥ 1 → 🔴 高亮

### problem_type 一致性检查

hegel step 完成后，比较 hegel report 中的 `signals.system_type` 与 osborn 产出物中的 `problem_type`。不一致时在 checkpoint 附加警告行。若 osborn 产出物无 `problem_type` 字段，跳过比较（不报错）。problem_type=pending 时不触发一致性检查。

### problem_type 路由

osborn P0 判定的 problem_type 通过 composition args 传递到每个下游 step，各 Skill 按 problem_type 调整侧重（不改变核心定义）：

| problem_type | hegel | bayes | feynman | debono |
|--------------|-------|-------|---------|--------|
| deterministic | 严格收敛，期望单一答案 | 事实验证，二元判定 | P1 加严：要求形式化证明 | 聚焦被忽略的形式逻辑 |
| non_deterministic | 允许多条可行路径 | 概率评估，区间量化 | P2 加权：不确定性标注 | 聚焦被忽略的概率空间 |
| mixed | 混合策略 | 分区域验证 | P1+P2 平衡 | 两者兼顾 |
| pending | 默认行为（LLM 自行判定 system_type） | 默认行为 | 默认行为 | 默认行为 |

用户回复后继续执行。若用户选择跳过，后续 depends_on 该步骤的 step 自动跳过（soft_depends_on 除外）。

## UltraPlan 并行模式（可选增强）

默认情况下，pipeline 线性串联执行（osborn→hegel→bayes→feynman→debono）。启用 `--parallel` 后，支持两个 fan-out 点：

### osborn 维度并行 fan-out

- **触发**：`--parallel` + osborn P0 定义了 ≥3 个维度轴
- **机制**：将维度轴分组（如 3 组 × 2 维度），每组启动一个 osborn 实例聚焦指定维度
- **参数**：`--focus-dimensions dim1,dim2`（osborn 参数，限制 P1/P2a/P2b 只在指定维度发散）
- **合并**：各实例产出拼接为统一 idea-pool，标记 `[parallel-{n}]` 来源
- **Critic**：hegel 承担 critic 角色，对合并后的 idea-pool 做收敛

### bayes 异构验证 fan-out

- **触发**：`--parallel` + bayes 进入 B2 软验证阶段
- **机制**：Claude 和 Qwen 各自独立验证，而非顺序执行
- **参数**：`--verify-mode dual`（bayes 参数，L2 异构双模型）
- **合并**：交叉验证——两模型结论一致 → VERIFIED；不一致 → 标记 DISPUTED，触发第三模型（Gemini）裁决
- **Critic**：bayes 汇总步骤自动处理合并

### 非破坏性保证

- 默认 `parallel.enabled: false`，pipeline 行为与未升级前完全一致
- `--parallel` 仅在用户显式请求时启用
- 并行产出质量由 critic 步骤保证（hegel 收敛 + bayes 交叉验证）
- 并行模式不影响 CHECKPOINT 协议——每个 fan-out 实例完成后仍触发 checkpoint

---

## --steps 子集执行

支持 `--steps hegel,bayes` 语法：
- 仅执行指定步骤及其依赖
- 未指定步骤的产出物需已存在（从上次运行恢复）
- 若依赖缺失且无法恢复，报错并提示补全

## 注意

- 所有原子 skill 仍可独立使用，本 composed skill 是可选上层编排
- debono 为 soft_depends_on + on_failure: skip，即使 feynman 失败也不阻断管线
- debono 完成后自动触发五转综合总结（debono V2.2 内置），生成 `docs/reports/{topic}-taixu-summary-{date}.md`，包含全程叙事、关键转折、核心洞察、元认知收获。此为强制步骤，不可跳过
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

  时间日志用于 retro 分析和 typical 值校准（≥10 次后用实际中位数替换初始估计值）。预算列用于评估 problem_type → budget 映射的准确性（≥3 次同类型后校准预算值）。相变信号汇总用于识别系统性认知偏差。
