# CHECKPOINT 协议

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

## 相变信号检测（方向 3）

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

## 全局时间预算（方向 5）

pipeline 启动时根据 problem_type 选择对应 `time_budget` 配置，全程追踪预算消耗：

1. **预算分配**：`problem_type` → `time_budget[problem_type]` → 各 step 的 `step_budget`
2. **累计追踪**：每 step 结束后 `cumulative_min += elapsed_min`，计算 `pct = cumulative_min / total_budget * 100`
3. **预警阈值**：
   - `pct > 80%` → 🟡 显示预算预警
   - `pct > 100%` → 🔴 显示预算超支
4. **不强制中断**：超预算时仅预警，不自动终止 pipeline（认知质量优先于速度）
5. **时间日志增强**：最终时间日志增加预算列

**problem_type 未确定时**：使用 `mixed` 预算配置（最通用）。osborn P0 判定 problem_type 后，若与 `mixed` 不同，从下一个 step 开始切换到对应预算配置。

## 时间追踪

每个 step 开始前和结束后各执行一次 `date '+%s'` 记录 epoch 时间戳，差值转换为分钟。⚠️ 时间追踪依赖 shell 环境可用；若 LLM 遗漏 `date` 执行，追踪静默失败（无报错，缺数据）。

```bash
step_start=$(date '+%s')
# ... 执行 step ...
step_end=$(date '+%s')
elapsed_min=$（， ，step_end - step_start， / 60 ，）
```

typical 基准值见 frontmatter `time_baselines`。初始值为估计值（基于 standalone 模式），使用 ≥10 次后用实际中位数替换。

## 信号展示

从 step 产出物（report 文件）的 YAML frontmatter 中提取 `signals` 字段，按 `checkpoint_signals` 配置过滤后展示。

高亮规则：
- hegel `terminal_status` 值 ≠ "converged" → 🔴 高亮
- hegel `system_type` 与 osborn `problem_type` 不一致 → 🔴 高亮
- feynman `veto_count` 值 ≥ 1 → 🔴 高亮

## problem_type 一致性检查

hegel step 完成后，比较 hegel report 中的 `signals.system_type` 与 osborn 产出物中的 `problem_type`。不一致时在 checkpoint 附加警告行。若 osborn 产出物无 `problem_type` 字段，跳过比较（不报错）。problem_type=pending 时不触发一致性检查。

## problem_type 路由

osborn P0 判定的 problem_type 通过 composition args 传递到每个下游 step，各 Skill 按 problem_type 调整侧重（不改变核心定义）：

| problem_type | hegel | bayes | feynman | debono |
|--------------|-------|-------|---------|--------|
| deterministic | 严格收敛，期望单一答案 | 事实验证，二元判定 | P1 加严：要求形式化证明 | 聚焦被忽略的形式逻辑 |
| non_deterministic | 允许多条可行路径 | 概率评估，区间量化 | P2 加权：不确定性标注 | 聚焦被忽略的概率空间 |
| mixed | 混合策略 | 分区域验证 | P1+P2 平衡 | 两者兼顾 |
| pending | 默认行为（LLM 自行判定 system_type） | 默认行为 | 默认行为 | 默认行为 |

用户回复后继续执行。若用户选择跳过，后续 depends_on 该步骤的 step 自动跳过（soft_depends_on 除外）。
