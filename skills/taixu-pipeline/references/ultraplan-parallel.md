# UltraPlan 并行模式（可选增强）

默认情况下，pipeline 线性串联执行（osborn→hegel→bayes→feynman→debono）。启用 `--parallel` 后，支持两个 fan-out 点：

## osborn 维度并行 fan-out

- **触发**：`--parallel` + osborn P0 定义了 ≥3 个维度轴
- **机制**：将维度轴分组（如 3 组 × 2 维度），每组启动一个 osborn 实例聚焦指定维度
- **参数**：`--focus-dimensions dim1,dim2`（osborn 参数，限制 P1/P2a/P2b 只在指定维度发散）
- **合并**：各实例产出拼接为统一 idea-pool，标记 `[parallel-{n}]` 来源
- **Critic**：hegel 承担 critic 角色，对合并后的 idea-pool 做收敛

## bayes 异构验证 fan-out

- **触发**：`--parallel` + bayes 进入 B2 软验证阶段
- **机制**：Claude 和 Qwen 各自独立验证，而非顺序执行
- **参数**：`--verify-mode dual`（bayes 参数，L2 异构双模型）
- **合并**：交叉验证——两模型结论一致 → VERIFIED；不一致 → 标记 DISPUTED，触发第三模型（Gemini）裁决
- **Critic**：bayes 汇总步骤自动处理合并

## 非破坏性保证

- 默认 `parallel.enabled: false`，pipeline 行为与未升级前完全一致
- `--parallel` 仅在用户显式请求时启用
- 并行产出质量由 critic 步骤保证（hegel 收敛 + bayes 交叉验证）
- 并行模式不影响 CHECKPOINT 协议——每个 fan-out 实例完成后仍触发 checkpoint
