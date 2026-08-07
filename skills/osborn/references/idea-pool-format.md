# Idea-Pool 输出格式

> 从 SKILL.md P3 段落外移。产出 idea-pool 时按此格式整理。

## YAML Frontmatter

```yaml
---
topic: "发散主题"
problem_type: "deterministic | non_deterministic | mixed | pending"
total_ideas: 42
dimensions:
  - 维度1
  - 维度2
  - 维度3
  - ...
# 条件字段：仅当想法总数低于 problem_type 对应下限（det 15 / mixed 30 / non_det 50）
# 且用户选择显式降级而非续跑时必填（SKILL.md 边界条件「想法数量远不足」门禁）：
idea_count_floor:
  expected: 50
  actual: 26
  downgraded: true
  reason: "降级原因（必填）"
---
```

## 正文结构

```markdown
# 想法池：{主题}

## P1 自由发散（{n1} 个）

1. {想法描述} `[P1]`
2. {想法描述} `[P1]` `[组合: #1 + #N]`
...

## P2a SCAMPER 补盲（{n2} 个）

### S Substitute
- {想法} `[P2a-S]`
### C Combine
- {想法} `[P2a-C]`
...

## P2b 视角轮换（{n3} 个）

### 用户视角
- {想法} `[P2b-用户]`
### 技术视角
- {想法} `[P2b-技术]`
### 竞争者视角
- {想法} `[P2b-竞争]`
### 边缘视角
- {想法} `[P2b-边缘]`
```

## 规则

- 每条想法**不带评分、不排序、不标"推荐"**——这些是 hegel 的工作
- 输出文件路径：`docs/osborn-pools/{topic-slug}-{date}.md`
