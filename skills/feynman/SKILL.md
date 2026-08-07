---
name: feynman
display_name: "太虚四转 · 破妄（费曼）"
description: >
  Audit（审查·太虚四转·破妄）: six self-deception principles via blind sub-agent. Use when user says
  "审查", "费曼", "feynman", "提交前把关", "反自欺", "/feynman".
version: "2.6.0"
visibility: public
last_updated: "2026-07-19"
metadata:
---

# Feynman 费曼审查

> *"The first principle is that you must not fool yourself — and you are the easiest person to fool."*
> — Richard Feynman

## 概述

代码写完、PRD 交稿，方案落地。但里面有没有在骗自己？AI 倾向于自圆其说，会说"这样对"而不是"可能有问题"。这个 skill 用六条原则检查产出物：假设没验证就当事实用、猜测被包装成结论，为不存在的需求写了代码、顺手改了不该改的地方，用想象代替实验、制造真相副本而不是引用原始来源。审查员是独立子 Agent，只看变更产物，看不到对话历史，没法被你的理由说服。

太虚五转第四转：破妄（审查）。提交前跑一遍六原则，把自欺的部分找出来。

## 理论框架

六条原则构成一条认知链：停下来（P1）→ 锚定推理（P2）→ 设计要简（P3）→ 执行要准（P4）→ 验收要闭环（P5）→ 数据要溯源（P6），分别防止假设伪装、伪装确定性，过度设计、附带伤害，自证清白、真相漂移。

原则权威定义：`CLAUDE.md`（SSOT，运行时动态读取，不内联）。

## 执行模式：subAgent 独立审查（默认）

同一个 Agent 既写代码又审查代码，上下文里全是"为什么这样做"的理由——你在用已有的理由为自己辩护，不是在审查。**subAgent 隔离的是上下文，不是能力。** 审查者只拿到 diff + 原则 + checklist，看不到对话历史、用户请求，你的推理过程。

Phase 1（收集变更）在主 Agent 完成，Phase 2 + Phase 3，审查 + 报告委派给 subAgent。主 Agent 向 subAgent 传递数据包（diff_content / changed_files / principles / checklist / report_template / problem_type），**禁止传递**对话历史、推理过程，用户评价、"为什么这样改"的解释。详见 [references/subagent-protocol.md](references/subagent-protocol.md)。

模式选择、降级条件，problem_type 适配、--scope 模式说明，与 liam-retro 分工详见 [references/decision-tables.md](references/decision-tables.md)。

## 输入

默认审查当前 git 工作区的未提交变更（`git diff` + `git diff --cached`）。也接受：指定文件路径、指定 commit 范围，指定 MR/PR、存量审查（`--scope module`）、依赖链审查（`--scope deps`）、`--problem-type`，可选，pipeline 传入。

## 审查流程

```
Phase 1 收集变更（主Agent）──→ 委派 subAgent ──→ Phase 2+3 审查+报告（subAgent）
     │                            │                        │
  输入: diff                  隔离上下文             输入: diff+原则+checklist
  输出: 文件清单+分类         只传数据包             输出: 审查报告 markdown
     │                                                    │
  CHECKPOINT 确认范围                              参照路由矩阵按文件类型聚焦
```

### Phase 1: 收集变更

收集 diff（默认）、module，指定目录代码文件、或 deps，diff 函数的 1 层调用链。超过 50 个文件（module）或 20 个依赖文件（deps）时要求用户缩小范围。

**CHECKPOINT**：展示变更文件清单（{N}个文件，{+lines}+/{-lines}-），确认审查范围后继续。

文件类型×原则路由矩阵、边界条件，module/deps 审查聚焦策略详见 [references/decision-tables.md](references/decision-tables.md)。

### Phase 2: 逐原则审查

对每条原则，按路由矩阵决定审查深度：● 逐条过 checklist，○ 快速扫描。判定 ✅ 通过 / ⚠️ 警告 / ❌ 失败。**必须引用具体证据** —`file_path:line_number` + 代码片段或 diff 行。

**判定分级**：❌ 判定区分"技术否决"（代码有明确错误）和"判断否决"，推翻设计决策。判断否决必须附带可执行的反例验证步骤，30 秒内可跑、可证伪，声明预期。附不出则降级为 ⚠️ 并标注 `[待验证]`。

详细检查项见 [references/checklist.md](references/checklist.md)。

不确定点深挖（Bayes 联动）流程详见 [references/decision-tables.md](references/decision-tables.md) 深挖章节。subAgent 深挖 prompt 模板详见 [references/subagent-protocol.md](references/subagent-protocol.md)。

### Phase 3: 输出报告

报告含 YAML frontmatter + 审查工作量量化 + 逐项判定表（6原则 × ✅/⚠️/❌）+ 合规率 + 问题清单 + 总结 + 下一步引导。判定阈值：6/6 通过，有⚠️无❌通过带建议，有❌不通过。详见 [references/report-format.md](references/report-format.md)。

## 不做的事

- 不做安全审计（用 `liam-cso` skill）
- 不做功能正确性测试（用单元测试 / e2e 测试）
- 不做代码风格检查（用 linter）
- 不修复问题——只报告。用户确认后再修
- 默认（diff 模式）不审查存量代码，除非用户指定 `--scope module/deps`
- 不审查会话行为模式（用 `liam-retro` Step 6）

---

## 沉淀协议：写入 BACKLOG

审查完成后有 ⚠️ 或 ❌ 级发现时，用 CLI flag 模式调用 `sink-to-backlog.py`（❌→ERROR, ⚠️→WARNING, ✅→跳过）。详见 [references/report-format.md](references/report-format.md)。
