# Skill Ecosystem References

Use this page as a short map of external skill systems worth tracking. These are references, not vendored dependencies.

## Authoring Standards

| Source | What to Borrow | Repository |
|--------|----------------|------------|
| Anthropic Agent Skills | `SKILL.md` folder contract, concise frontmatter, progressive disclosure, optional `scripts/`, `references/`, and `assets/` | [anthropics/skills](https://github.com/anthropics/skills) |
| Anthropic `skill-creator` | Description-first triggering, realistic eval prompts, baseline comparison, iteration based on human feedback | [anthropics/skills/skill-creator](https://github.com/anthropics/skills/tree/main/skills/skill-creator) |
| Superpowers `writing-skills` | Treat skill writing as TDD for process documentation: observe failure, write the skill, verify behavior, then refactor | [obra/superpowers](https://github.com/obra/superpowers/tree/main/skills/writing-skills) |

## Host Packaging and Runtime Boundaries

| Source | What to Borrow | Documentation |
|--------|----------------|---------------|
| Agent Skills specification | Portable `SKILL.md` contract, progressive disclosure, and string-based metadata | [agentskills.io specification](https://github.com/agentskills/agentskills/blob/main/docs/specification.mdx) |
| Claude Code plugins and hooks | Versioned skill packaging plus deterministic lifecycle adapters | [Plugins](https://code.claude.com/docs/en/plugins), [Hooks](https://code.claude.com/docs/en/hooks) |
| OpenAI developer platform | Skills and MCP as reusable capability layers; use representative evals for behavior changes | [OpenAI Developers](https://developers.openai.com/), [Codex use cases](https://developers.openai.com/codex/use-cases) |
| DeepSeek Harness | Native skill directories, provider registration, and bundle/profile distribution | [Skills subsystem](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/subsystems/skills.md), [Publishing](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/publish.md) |

## Workflow Patterns

| Source | What to Borrow | Repository |
|--------|----------------|------------|
| Superpowers bootstrap discussion | Make bootstrap visible, include the available skill list, and avoid silent hidden behavior | [obra/superpowers issue 223](https://github.com/obra/superpowers/issues/223) |
| OpenCrabs | Local-first memory, procedural command capture, cross-session recall, and user-owned improvement data | [adolfousier/opencrabs](https://github.com/adolfousier/opencrabs) |
| ELL-StuLife | Experience-driven loop: exploration, long-term memory, skill learning, and knowledge internalization | [ECNU-ICALK/ELL-StuLife](https://github.com/ECNU-ICALK/ELL-StuLife) |

## Rules for This Repository

1. Keep `SKILL.md` lean. Put long examples, templates, or case studies in `references/` or `docs/`.
2. Put trigger intent in frontmatter `description`. Keep standard metadata values portable and string-based.
3. Treat host hooks and workflow chaining as adapter configuration. If a repository uses a `metadata.hooks` extension, label it as non-portable intent rather than native host automation.
4. Add representative evals for judgment-heavy skills and tests for deterministic runtime behavior.
5. Self-improvement must capture redacted, bounded candidates first, validate them with auditable evidence, and apply only one narrow behavior change to a named durable owner.
6. Verify current host capabilities before claiming a hook, tool, or extension is executable.
7. When adopting external skills, link to the source and record the borrowed pattern instead of copying large upstream skill bodies.
