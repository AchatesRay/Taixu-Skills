# Elicitation Rules

These rules govern osborn's P0-clarify phase — the progressive Q&A dialogue that clarifies a vague topic before divergence begins. They are adapted from the former ce-brainstorm skill's interaction rules.

## When P0-clarify activates

P0-clarify runs ONLY when the user's input is too vague for direct divergence. If the topic is already clear (one sentence, identifiable problem space), skip directly to P0.1.

**Clarity test:** Can you state the divergence topic in one sentence AND identify at least 3 problem-space dimension axes? If yes, topic is clear — skip P0-clarify. If no, run P0-clarify.

## Core interaction rules

1. **Ask one question at a time** — One question per turn, even when sub-questions feel related. Stacking several questions in a single message produces diluted answers; pick the single most useful one and ask it.

2. **Prefer single-select multiple choice** — Use the platform's blocking question tool (`AskUserQuestion` in Claude Code). Options scaffold the answer without confining it — well-chosen options surface dimensions the user may not have separated.

3. **Use multi-select rarely and intentionally** — Only for compatible sets such as goals, constraints, or success criteria that can all coexist. If prioritization matters, follow up by asking which selected item is primary.

4. **Use an open-ended question only when genuinely open** — Drop the blocking tool only when (a) the answer is inherently narrative ("walk me through how you got here"), (b) presented options would unintentionally influence the user's answer, or (c) you cannot write 3-4 genuinely distinct options without padding.

5. **Open-ended questions earn their place by being specific** — Good: "What's the most concrete thing someone's already done about this — paid for it, built a workaround, quit a tool over it?" Too thin: "What's your take?"

## Scope tiering

Before deep elicitation, assess how much exploration is needed:

| Tier | Signal | P0-clarify depth |
|------|--------|-----------------|
| Quick | User has a clear goal, just needs direction confirmation | 1-2 exchanges, skip to P0 |
| Standard | Some unknowns, needs to explore the problem space | 3-5 exchanges |
| Deep | Vague goal, high uncertainty, or high-stakes decision | 5-8 exchanges, structured convergence |

## Elicitation sequence

Progressive clarification follows this sequence (adapt based on tier):

1. **What** — What's the feature/improvement/problem you're thinking about?
2. **Why** — What's prompting this? What would success look like?
3. **Who** — Who is this for? Whose preferences matter?
4. **Boundaries** — What have you ruled out? What constraints exist?
5. **Readiness** — Is the topic clear enough to start divergent exploration?

Each step is ONE question. Move to the next only when the current one is satisfactorily answered.

## Transition to P0

When P0-clarify has enough information:
- Synthesize what you've heard into a one-sentence topic
- Confirm with the user
- Proceed to P0.1 (problem type classification) and the rest of P0

If after 2-3 rounds the topic is still too vague to diverge, suggest hegel --spec-only for structured requirements specification instead.
