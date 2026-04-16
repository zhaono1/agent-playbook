# Context Layering for Agent Playbooks

Context engineering is not just about adding more files. Good agent repositories decide what must always be remembered, what should be routed briefly, and what should be loaded only on demand.

## Core rule

Use this heuristic when structuring prompts, skills, and docs:

- Keep hard constraints always-on
- Turn reusable methods into skills
- Keep facts retrievable from references instead of cramming them into startup context

This keeps agent systems smaller, more portable, and easier to maintain.

## The three-layer model

### Layer 1: Always-on constraints

Reserve the default startup context for information that must be present in every session:

- Safety boundaries
- Permission boundaries
- Delivery rules
- Definition of done
- A small number of high-frequency behavioral constraints

This layer should be short and stable. If a rule changes often or is only relevant in one workflow, it probably does not belong here.

### Layer 2: Short routing cards

Use a thin routing layer for workflow reminders. Each card should keep the rule skeleton short and point to a skill or reference for details.

Good examples:

- "Use the review baseline before approving code."
- "For long-running work, recover state before taking new action."
- "Escalate from manual execution to skills to automation only when the pattern is stable."

Layer 2 reduces startup cost without making the system forget how to navigate.

### Layer 3: On-demand references

Keep detailed procedures, templates, examples, and case studies in docs or `references/` files. Load them only when the task actually needs them.

Good examples:

- Long workflow guides
- Recovery state machines
- Tool-specific runbooks
- Pattern libraries
- Example outputs

This is where depth belongs.

## Skill authoring rules

When creating or updating skills:

1. Keep `SKILL.md` lean and procedural.
2. Move detailed examples, templates, and long explanations into `references/`.
3. Prefer small, focused reference files over one large manual.
4. Use file names that make retrieval obvious.
5. Keep public skills abstract and portable unless the repository is intentionally private.

## Retrieval rules

Effective agent systems also optimize retrieval:

- Select only the most relevant files for the task
- Put decision-critical context early and late when ordering matters
- Isolate sub-problems to workers instead of stuffing everything into one prompt
- Persist long-task state outside chat so recovery is deterministic

## Review checklist

Use this checklist before publishing a new skill or playbook:

- Can a new session recover core constraints without loading everything?
- Is the long-form detail available through references instead of startup context?
- Can the skill operate from `SKILL.md` plus one or two focused references?
- Is the content portable across users, projects, and companies?
- Have private, business-specific, or user-identifying details been removed?

## Why this matters

Large prompts feel powerful until they become noisy. Layered context makes repositories easier to search, easier to evolve, and safer to share publicly.
