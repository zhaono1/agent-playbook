# Skill Ecosystem References

Use this page as a short map of external skill systems worth tracking. These are references, not vendored dependencies.

## Authoring Standards

| Source | What to Borrow | Repository |
|--------|----------------|------------|
| Anthropic Agent Skills | `SKILL.md` folder contract, concise frontmatter, progressive disclosure, optional `scripts/`, `references/`, and `assets/` | [anthropics/skills](https://github.com/anthropics/skills) |
| Anthropic `skill-creator` | Description-first triggering, realistic eval prompts, baseline comparison, iteration based on human feedback | [anthropics/skills/skill-creator](https://github.com/anthropics/skills/tree/main/skills/skill-creator) |
| Superpowers `writing-skills` | Treat skill writing as TDD for process documentation: observe failure, write the skill, verify behavior, then refactor | [obra/superpowers](https://github.com/obra/superpowers/tree/main/skills/writing-skills) |

## Workflow Patterns

| Source | What to Borrow | Repository |
|--------|----------------|------------|
| Superpowers bootstrap discussion | Make bootstrap visible, include the available skill list, and avoid silent hidden behavior | [obra/superpowers issue 223](https://github.com/obra/superpowers/issues/223) |
| OpenClaw self-improvement skill | Log learnings, errors, feature requests, and promote broadly useful knowledge into repo instructions | [openclaw/skills self-improving-agent](https://github.com/openclaw/skills/tree/main/skills/pskoett/self-improving-agent) |
| OpenCrabs | Local-first memory, procedural command capture, cross-session recall, and user-owned improvement data | [adolfousier/opencrabs](https://github.com/adolfousier/opencrabs) |
| ELL-StuLife | Experience-driven loop: exploration, long-term memory, skill learning, and knowledge internalization | [ECNU-ICALK/ELL-StuLife](https://github.com/ECNU-ICALK/ELL-StuLife) |

## Rules for This Repository

1. Keep `SKILL.md` lean. Put long examples, templates, or case studies in `references/` or `docs/`.
2. Put trigger intent in frontmatter `description`; put runtime chaining in `metadata.hooks`.
3. Treat `metadata.hooks` as the source of truth for skill chaining. Avoid duplicate hardcoded hook maps in CLI code.
4. Add tests for objective skill behavior when a skill has deterministic outputs or workflow steps.
5. Self-improvement should create traceable memory/proposal artifacts first, then promote to skill changes only after validation or explicit user approval.
6. When adopting external skills, link to the source and record the borrowed pattern instead of copying large upstream skill bodies.
