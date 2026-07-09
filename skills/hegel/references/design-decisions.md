# 设计决策

> 从 SKILL.md §16 移出。历史决策记录，非运行时逻辑。

| # | 决策 | 理由 |
|---|------|------|
| D1 | 三维架构（骨架×透镜×路由） | 领域扩展只需新建 lens 文件，不改核心管线 |
| D2 | JSON 状态落盘 | 支持跨窗口恢复、审计追溯、收敛脚本自动判定 |
| D3 | 类型感知收敛 | 不同不确定性类型有不同的"确定够了"标准 |
| D4 | 底线门禁独立横切 | 不嵌入步骤内部，统一触发时机和响应协议 |
| D5 | 安全阀参数化 | hard_cap 按 lens 分化 + onto_bonus，避免无限循环 |
| D6 | Lens 快速路径 | 保留 code lens 直出 findings 的效率，不强制 claim-extract |
| D7 | Emergent 约束冷却期 | 防止运行时发现的约束在未经审查前影响判定 |
| D8 | S2.5 rigor gate 预筛 | 断言质量预筛过滤低质量 claim，减少 S3 bayes 算力浪费；rigor probes 从 ce-brainstorm 吸收 |
| D9 | debono 归真对冲检查点 | 防止纯批判管线导致「批判致死」，确保被排除方案的价值面被记录 |
| D10 | Architecture target_type 物化前置 | 架构论述不是代码/文档，无法被 claim-extract 直接解析；强制物化为文档后再走通用路径，避免静默降级为手动推理 |
| D11 | --lite 仅影响初始化骨架 | lite_mode 只改变 state.json 初始参数，不作为跳过步骤的许可证；防止 Agent 自行发明精简版执行流程 |
| D12 | --standalone 防嵌套降级 | taixu-pipeline 编排器传入时跳过 S3/S4/S5 内嵌 bayes/feynman，由 pipeline 后续步骤使用独立 skill 完整能力；独立调用 /hegel 时禁止使用此参数 |
