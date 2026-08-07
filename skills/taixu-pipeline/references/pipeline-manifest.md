# Pipeline Manifest

编排 DAG、时间基线、检查点信号、相变信号、时间预算、UltraPlan 并行模式。

## 编排 DAG（composition.steps）

```yaml
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
      evidence_precision: required  # D11 修复：refuted 判定必须附精确数据源，禁止估算值推翻
    checkpoint: true

  - id: feynman
    kind: skill
    skill: feynman
    depends_on: [bayes]
    args:
      input: "{{ steps.bayes.output.report_path }}"
      problem_type: "{{ steps.osborn.output.problem_type }}"
      review_mode: subagent      # D12 修复：盲审强制化，时间预算紧不构成降级理由
      leniency_check: true       # D12 修复：0 veto 且合规率≥5/6 时触发宽松度自查
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
```

## 时间基线（time_baselines）

初始估计值（基于 standalone 模式），使用 ≥10 次后用实际中位数替换。

| 步骤 | 预估时间 | 备注 |
|------|---------|------|
| osborn | 8min | |
| hegel | 8min | standalone 模式（跳过 S3/S4/S5） |
| bayes | 10min | |
| feynman | 10min | |
| debono | 8min | |

## 检查点信号（checkpoint_signals）

| 步骤 | 信号 |
|------|------|
| hegel | terminal_status, system_type |
| feynman | veto_count |

## 相变信号（phase_transition_signals）

各转内部的状态突变检测。

### hegel

| 字段 | 转换 | 动作 | 说明 |
|------|------|------|------|
| signals.terminal_status | converged → diverged/truncated | warn | 收敛状态突变——从未收敛变为发散或截断 |
| signals.system_type | any change from osborn problem_type | warn | 系统类型与问题类型不一致 |

### bayes

| 字段 | 阈值 | 动作 | 说明 |
|------|------|------|------|
| signals.refuted_count | >=2 | highlight | 多个预测被推翻——方案假设可能有系统性偏差 |
| signals.blindspot_count | >=3 | highlight | 盲区数量高——认知覆盖不足 |

### feynman

| 字段 | 阈值/转换 | 动作 | 说明 |
|------|----------|------|------|
| signals.truth_drift | none → detected | highlight | 真相漂移——目标已被替换为代理指标 |
| signals.veto_count | >=1 | highlight | 存在阻塞级否决——进入 Execute 前必须修复 |

### debono

| 字段 | 阈值 | 动作 | 说明 |
|------|------|------|------|
| signals.survival_rate | <0.3 | warn | 存活概率低——命题可能确实无价值 |

## 时间预算（time_budget）

按问题类型分配（初始估计值，需 ≥3 次实战后校准）。

| problem_type | osborn | hegel | bayes | feynman | debono | total |
|-------------|--------|-------|-------|---------|--------|-------|
| deterministic | 6min | 6min | 8min | 8min | 6min | 34min |
| non_deterministic | 10min | 10min | 12min | 12min | 10min | 54min |
| mixed | 8min | 8min | 10min | 10min | 8min | 44min |
| pending | inherit mixed | — | — | — | — | — |

## UltraPlan 并行模式

默认线性串联（`enabled: false`），需显式启用 `--parallel`。

| fanout 点 | 策略 | 最大并行数 | 合并方式 |
|-----------|------|-----------|---------|
| osborn | focus-dimensions（按维度轴 fan-out） | 3 | concatenate（拼接 idea-pool） |
| bayes | verify-mode（按验证模式 fan-out） | 2 | cross-validate（交叉验证后取一致结论） |

**Critic 步骤**：fan-out 产出后自动触发，由 hegel 承担（合并收敛多个 fan-out 产出）。

UltraPlan 并行模式详见 [ultraplan-parallel.md](ultraplan-parallel.md)。
