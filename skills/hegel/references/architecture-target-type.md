# Architecture target_type 执行协议

> 从 SKILL.md §5.3 移出。当 `target_type == "architecture"` 时使用。

## 前置条件：物化输入

架构分析必须有**可被脚本和提示词消费的文本载体**。如果用户输入是对话中的口头论述，必须先物化为文档：

```bash
# 将架构论述写入临时文档作为 target_text
cat > /tmp/architecture-input.md << 'EOF'
{用户的架构决策论述}
EOF
```

物化后的文档作为 S2 claim-extract 的 `target_text` 输入。

## Scope 构建要求

architecture 类型的 scope 必须包含以下维度（区别于 code lens 的默认维度）：

| dimension | name | weight | source | active | 说明 |
|-----------|------|--------|--------|--------|------|
| consistency | 内部一致性 | 0.25 | lens_template | true | 方案内部是否自洽？各组件间有无矛盾？ |
| feasibility | 可行性 | 0.25 | lens_template | true | 在当前约束下是否可实现？ |
| maintainability | 可维护性 | 0.20 | lens_template | true | 长期维护成本是否可控？ |
| migration_risk | 迁移风险 | 0.15 | lens_template | true | 从现状迁移到目标状态的风险？ |
| alternative_coverage | 替代方案覆盖 | 0.15 | lens_template | true | 是否充分评估了替代方案？ |

system_type 默认为 `deterministic`（架构决策本身是确定性的，不确定性来自信息不完整）。

## 发现分类

architecture 类型使用独立的 category 枚举（覆盖 lens-code §2 的默认分类）：

| category | 核心问题 |
|----------|---------|
| internal_consistency | 方案各部分是否自洽？ |
| assumption_validity | 关键假设是否成立？ |
| migration_feasibility | 迁移路径是否可行？ |
| alternative_gap | 是否有未评估的更优方案？ |
| scope_creep | 方案是否超出原始问题边界？ |
| dependency_risk | 对外部系统/团队的依赖是否可控？ |

## 深化策略适配

| 策略 | architecture 场景方法 |
|------|---------------------|
| D1 删除测试 | "去掉这个设计决策，问题还能解决吗？" |
| D2 因果追溯 | 追踪"为什么选 A 不选 B"的完整推理链 |
| D3 边界探测 | 找方案的失效条件：规模翻倍、团队减半、时间压缩 |
| D4 复现验证 | 用独立视角（如 feynman subAgent）重新评估同一方案 |

## 禁止行为

- **禁止**在无物化文档的情况下直接进入 S2 claim-extract
- **禁止**用手动推理替代 bayes calibrate / feynman subAgent
- **禁止**将 `--lite` 参数理解为"可以跳过步骤"——它仅影响 state.json 初始骨架
- **禁止**自行发明精简版/lite mode 执行流程；如果管线不适配，应触发 reassess_scope 或 halt，而非静默降级
