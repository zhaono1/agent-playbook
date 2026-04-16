# @codeharbor/agent-playbook

Local skill manager and installer for agent-playbook across Claude Code, Codex, and Gemini.

## Quick Start

```bash
pnpm dlx @codeharbor/agent-playbook init
# or
npm exec -- @codeharbor/agent-playbook init
```

Project-only setup:

```bash
pnpm dlx @codeharbor/agent-playbook init --project
```

## What It Does
- Links skills to `~/.claude/skills`, `~/.codex/skills`, and `~/.gemini/skills` (or project `.claude/.codex/.gemini`).
- Installs a stable CLI copy under `~/.claude/agent-playbook/` for hook execution.
- Adds Claude hooks for SessionEnd (session logs) and PostToolUse (self-improve MVP).
- Records an `agent_playbook` metadata block in `~/.codex/config.toml`.
- Prepares Gemini skill directories, but does not wire Gemini hooks yet.
- Provides a local-only skills manager via `apb skills ...`.

## Platform support

| Platform | Skill install | Hooks/config automation | Current status |
|----------|---------------|-------------------------|----------------|
| Claude Code | Yes | Installs SessionEnd and PostToolUse hooks | Full |
| Codex | Yes | Writes `agent_playbook` metadata block | Partial |
| Gemini | Yes | No hook wiring yet | Skill distribution only |

## Commands
- `agent-playbook init [--project] [--copy] [--overwrite] [--hooks] [--no-hooks] [--session-dir <path>] [--dry-run] [--repo <path>]`
- `agent-playbook status`
- `agent-playbook doctor`
- `agent-playbook repair [--overwrite]`
- `agent-playbook uninstall`
- `agent-playbook session-log [--session-dir <path>]`
- `agent-playbook self-improve`
- `agent-playbook skills [list|info|add|remove|enable|disable|doctor|sync|upgrade|export|import]`

`apb` is a short alias for `agent-playbook`.

## Skills Manager Examples

```bash
apb skills list --scope both --target all
apb skills add ./skills/my-skill --scope project --target claude
apb skills disable my-skill --scope project --target claude
apb skills enable my-skill --scope project --target claude
```

## Notes
- Default session logs go to repo `sessions/` if a Git root is found; otherwise `~/.claude/sessions/`.
- If skill folders already exist, you will be prompted before overwriting. Use `--overwrite` to skip the prompt.
- Session logs and self-improve entries record the agent-playbook version.
- Hooks are merged without overwriting existing user hooks.
- Requires Node.js 18+.

## Advanced
- Override Claude/Codex/Gemini config paths for testing:
  - `AGENT_PLAYBOOK_CLAUDE_DIR=/tmp/claude`
  - `AGENT_PLAYBOOK_CODEX_DIR=/tmp/codex`
  - `AGENT_PLAYBOOK_GEMINI_DIR=/tmp/gemini`
