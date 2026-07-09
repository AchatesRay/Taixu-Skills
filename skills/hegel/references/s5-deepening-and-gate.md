# S5 深化策略与底线门禁

> 从 SKILL.md §8/§9/§12 外移。运行时按需查阅。

## S5 深化策略路由

按 `claim_type` 选择策略（路由表在 lens 文件 §6 中）：

| 策略 | 方法 | 典型 claim_type |
|------|------|----------------|
| D1 删除测试 | "删掉假设，论点还站得住吗？" | evaluative, prescriptive |
| D2 因果追溯 | 追踪完整因果链 | causal |
| D3 边界探测 | 找边界条件和极端情况 | factual（边界型） |
| D4 复现验证 | 独立方法重新验证 | factual（核心型） |

按 `uncertainty_type` 路由 skill：

| uncertainty_type | 深化策略 | 验证方式 |
|------------------|---------|---------|
| deterministic | 根因追溯 → 复现 | bayes B1 硬验证 |
| epistemic | 证据扩展 → 多源补数据 | bayes B2 双模型 |
| ontological | 情景分析 → 鲁棒性测试 | bayes B2 概率分布 |

### S5 补充规则

- 条件先验重置：收到 feynman_reset 信号的 finding，先验重置为 0.5
- Snap-back 检测：重置后后验落入重置前 ±0.05 区间 → 标记 `snap_back_detected`。severity ≥ high 时升级为 escalate
- Confidence Interval：epistemic findings 由 S5 bayes verify 产出 90% CI
- 新增 finding/claim：S5 可追加新 claims 和 findings（标注 source_pass），新 findings 的 uncertainty_type 由 S5 inline 分配
- 重分类：发现 uncertainty_type 判定有误时，新增 finding（修正后类型）+ dismiss 原 finding

## 底线门禁系统

触发时机：每步写完 state.json 后、进入下一步前。

### 三种约束

| 类型 | 方向 | 违反响应 |
|------|------|---------|
| Axiom | 不可变 | halt |
| Parameter | 阈值可调 | warn / escalate |
| Emergent | 运行时发现 | 冷却→升级 |

### 检查逻辑

- structural：Python 规则求值，<10ms/条
- semantic：独立 LLM 调用，2-5s/条。semantic 约束总数建议不超 10 条

### 五级响应

| 响应 | 行为 |
|------|------|
| continue | 无违规，继续 |
| warn | 追加 gate_log[]，继续 |
| escalate | 追加 gate_flags[]，继续。同一约束连续 2 次 escalate → 自动 halt |
| reassess_scope | 回退到 S1 重新定界（仅限 S3/S4 后首次）。claims[] 标记 superseded，claim_derived findings dismissed |
| halt | 写 abort_reason → status=aborted → 终止 → 输出违规报告 |

## 不确定性路由速查

### 两阶段分类

| 阶段 | 粒度 |
|------|------|
| S2 提取 | "2+1"（deterministic / non_deterministic / causal→tbd） |
| S3 校准 | 三分法（deterministic / epistemic / ontological） |

### 按类型路由

| 原则 | deterministic | epistemic | ontological |
|------|--------------|-----------|-------------|
| P2 校准 | 硬验证→二值 | 软验证→区间 | 概率分布→接受 |
| P3 偏差 | F1 假设验证 | F2+F5 框架 | F2+F3 精确化 |
| P4 深化 | 根因追溯→复现 | 证据扩展→多源 | 情景+鲁棒性 |
| P5 收敛 | ≥0.85 或 ≤0.15 | CI<0.3 | 稳定 2 轮 |

### problem_type 适配

| problem_type | S6 收敛判定调整 |
|--------------|-----------------|
| deterministic | C4 收敛阈值收紧：≥0.90 或 ≤0.10 |
| non_deterministic | C4 允许多条 viable path 同时收敛 |
| mixed | C4 分区域判定：deterministic 部分严格，epistemic 部分宽松 |
| pending | 当前行为不变 |
