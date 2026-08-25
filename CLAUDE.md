# Claude Code Instructions for agent-playbook

## Default Behavior

When working on this repository, **always use the skill-router skill first** when:
- User asks for help or guidance
- Request seems ambiguous or could use multiple skills
- User mentions "skill", "which", "how to"
- User is unsure about the best approach

## Skill Priority

The skill-router should be your entry point for all skill-related questions. It will:
1. Analyze the user's request
2. Match to the most appropriate skill
3. Ask clarifying questions if needed
4. Recommend the best skill for the task

## When Creating PRs

Always use the `create-pr` skill when:
- User asks to create a pull request
- User says "submit my changes" or "push and create PR"
- User wants to submit code for review

This ensures bilingual documentation stays in sync.

## Commit, Push, and PR Boundaries

- "commit" / "提交代码" authorizes a local commit only.
- "push" / "推送" authorizes updating the named remote branch.
- "create PR" / "提交审核" / "提交并创建 PR" authorizes opening a pull request.

Do not infer push or PR authority from a commit-only request. When the user
explicitly asks for end-to-end submission or release, the requested chain may
continue without redundant confirmation.

## Project Context

This is the **agent-playbook** repository - a collection of portable agent skills.
- Skills are located in `skills/` directory
- Each skill has a `SKILL.md` file (the actual skill)
- Each skill may have a `README.md` file (documentation)
- The CLI can install skills for Claude Code, Codex, Gemini, and DeepSeek Harness
