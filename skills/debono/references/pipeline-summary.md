# 五转综合总结协议

> 从 SKILL.md 外移。debono 作为太虚五转管线最后一步时强制执行。

## 触发条件

满足以下任一条件即触发：
- taixu-pipeline 编排器调用 debono 时传入 `--pipeline-context` 参数
- 当前会话中存在前四转的产出物文件（osborn-pool + hegel-report + bayes-report + feynman-report）
- 用户显式传入 `--summary` 参数

**不触发**：debono 独立调用（非五转管线上下文）时不执行此步骤。

## 执行步骤

1. **收集前四转产出物**：读取 osborn-pool、hegel-report、bayes-report、feynman-report 的路径和内容摘要
2. **读取本次 debono 产出**：存活论证 + 四维价值扫描
3. **生成综合总结**：按下方模板写入 `docs/reports/{topic-slug}-taixu-summary-{date}.md`

## 输出模板（强制结构）

```markdown
# {主题} — 太虚五转综合报告

> 日期：{date}
> 输入：{原始方案路径}
> 五转产出物链：osborn → hegel → bayes → feynman → debono

---

## 一句话结论
{用一句话概括五转后的最终判断}

---

## 全程概述
{从调研/问题定义到五转完成的完整叙事，2-3 段}

## problem_type 路由判定声明（强制进正文）

| 项 | 内容 |
|----|------|
| 判定结果 | {deterministic / non_deterministic / mixed} |
| 判定依据 | {三信号各自结论：问题结构 / 认知边界 / 结果可证伪性} |
| 置信度 | {高/中/低 + 一句话理由} |
| 预算配置 | {是否从 mixed 切换到对应预算，从哪个 step 起生效} |

## 五转过程摘要

| 转 | Skill | 做了什么 | 核心数字 |
|:--:|-------|---------|---------|
| 一转 | Osborn | {一句话} | {关键指标} |
| 二转 | Hegel | {一句话} | {关键指标} |
| 三转 | Bayes | {一句话} | {关键指标} |
| 四转 | Feynman | {一句话} | {关键指标} |
| 五转 | Debono | {一句话} | {关键指标} |

## 相变信号汇总（强制进正文）

从各转产出物 frontmatter `signals` 字段提取，与 phase_transition_signals 配置匹配：

| 转 | 信号 | 值 | 触发动作 |
|:--:|------|----|---------|
| hegel | terminal_status / system_type | {值} | {无 / warn / highlight} |
| feynman | veto_count / truth_drift | {值} | {无 / warn / highlight} |
| debono | survival_rate | {值} | {无 / warn / highlight} |

{若 ≥2 个 highlight 级信号：标注 `phase_transition_cluster` 并提示系统性偏差；若全程无触发：如实写「全程无相变信号触发」}

## 关键认知转折点
{五转过程中最重要的 3-5 个认知转折——哪些发现改变了方向？哪些前提被证伪？}

## 核心洞察（五转后沉淀）
{从全程分析中提炼的 3-5 条可持续复用的洞察，不限于本次主题}

## 最终判定 / 行动计划
{方案/决策的最终状态：落地优先级、搁置项、新增项}

## 时间日志与预算对照（强制进正文）

| 转 | 实际耗时 | 预算 | 累计消耗 | 偏离标注 |
|:--:|---------|------|---------|---------|
| osborn | {elapsed} | {step_budget} | {pct}% | {正常 / >2x typical / 超支} |
| hegel | {elapsed} | {step_budget} | {pct}% | {同上} |
| bayes | {elapsed} | {step_budget} | {pct}% | {同上} |
| feynman | {elapsed} | {step_budget} | {pct}% | {同上} |
| debono | {elapsed} | {step_budget} | {pct}% | {同上} |

{若各转 time_log 仅为占位符、无真实耗时：如实标注「本次运行时间日志为占位记录，未追踪真实耗时」，不得省略本章节或虚构数字}

## 元认知收获
{对五转流程本身的反思：哪些环节产出了意外发现？流程有无结构性偏差？}

## 协议要素合规自检表（强制进正文）

逐项声明 2.0 协议要素的执行状态，写清证据位置（文件路径 / 章节 / frontmatter 字段）：

| 协议要素 | 状态 | 证据位置 |
|---------|------|---------|
| problem_type 路由 | {已执行 / 降级 / 未执行} | {位置} |
| 时间日志 | {已执行 / 占位 / 未执行} | {位置} |
| 相变信号 frontmatter | {已执行 / 未执行} | {位置} |
| 回归语料与隔离合规 | {合规 / 有污染已披露 / 不适用} | {位置} |
| subAgent 盲审（feynman） | {subagent / 降级本地 / 未执行} | {位置} |
| debono 存活概率量化 | {已量化 / 定性 / 未执行} | {位置} |

合规率：{n}/6。{若有降级或未执行项，一句话说明原因}

## 产出物清单

| 文件 | 类型 |
|------|------|
| {路径} | {描述} |
```

## 设计约束

- **必须综合全部五转**：不是只总结 debono，是从调研/问题定义到 debono 的完整叙事
- **必须包含"元认知收获"**：对本次五转流程本身的反思
- **四项埋点必须进正文**：problem_type 路由判定声明、相变信号汇总、时间日志与预算对照、协议要素合规自检表，四者必须以正文章节形式出现——只写进 frontmatter 或散落在各转报告里不算完成（盲评 sanitize 必剥 frontmatter，评委只看 summary 正文）。无数据的项如实标「未执行/未追踪」，不得省略章节
- **必须写入文件**：产出物落盘到 `docs/reports/`
- **字数控制**：综合总结 1500-3000 字（四项埋点表格不计入字数）
