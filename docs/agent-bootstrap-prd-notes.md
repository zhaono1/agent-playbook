# PRD Notes: Agent Playbook One-Click Setup and Skill Workflow Fixes

> Historical research snapshot from the original bootstrap planning work. Do not
> treat local-machine observations in this file as current repository state.

## Raw Requirements
- User wants one-click usage for this project.
- Skill storage locations differ between OpenAI Codex and Claude Code; need unified installation.
- Terminal/shell configuration differs across terminals.
- Provide packaging option (e.g., NPM package or other format).
- Prefer PNPM or NPM for distribution/installation.
- Package scope prefix should be `@codeharbor`.
- Package name: `@codeharbor/agent-playbook`.
- Session logs are not auto saved.
- Self-improving agent does not appear to run.

## Constraints
- Must support Claude Code and Codex (Codex storage/config specifics TBD).
- Should avoid destructive changes.
- Cross-shell support (zsh, bash, fish, PowerShell?) is likely needed.
- Offline-friendly install preferred; minimize network dependence.

## Research Findings
- Current docs recommend symlinking skills to `~/.claude/skills` or copying into `.claude/skills` (README).
- Auto-trigger and workflow-orchestrator are documented but there is no runtime automation in this repo; `session-logger` is manual by default.
- `self-improving-agent` requires hooks configured in Claude Code settings; hook scripts should avoid logging raw tool payloads.
- `skills/self-improving-agent/memory` only contains `semantic-patterns.json`; episodic/working memory directories are not present.
- MCP server exists for skill discovery; current Claude Code MCP configuration should use `claude mcp add`, `.mcp.json`, or `~/.claude.json` depending on scope.
- The local `~/.claude/settings.json` observation below was a dated machine snapshot and should be rechecked before use.
- The local `~/.claude/skills` observation below was a dated machine snapshot and should be rechecked before use.
- Claude Code hooks are configured in `~/.claude/settings.json`, `.claude/settings.json`, or `.claude/settings.local.json` (official hooks docs). SessionStart/SessionEnd hooks exist and include `transcript_path` in input, useful for session logging. (https://code.claude.com/docs/en/hooks)
- Codex reads config from `~/.codex/config.toml` and shares config between CLI and IDE. (https://developers.openai.com/codex/config-basic)
- Codex skill search paths include repo and user scopes: `$CWD/.codex/skills`, `$REPO_ROOT/.codex/skills`, and user `$CODEX_HOME/skills` (default `~/.codex/skills`). Codex supports symlinked skill folders. (https://developers.openai.com/codex/skills)
- npm CLI packaging uses `package.json` `bin` field; global install creates a symlink/cmd and requires a Node shebang. (https://docs.npmjs.com/cli/v11/configuring-npm/package-json)
- One-shot CLI execution options: `npm exec -- <pkg>` or `pnpm dlx <pkg>` for no-install bootstrap. (https://docs.npmjs.com/cli/v11/commands/npm-exec, https://pnpm.io/cli/dlx)

## Architecture Options
- Option A: NPM/PNPM CLI installer that:
  - Links skills to `~/.claude/skills` and `~/.codex/skills` (or repo `.codex/skills`).
  - Writes/merges Claude hooks in `~/.claude/settings.json` or project `.claude/settings.json`.
  - Adds a session logger based on `SessionEnd` hook using `transcript_path`.
  - Optionally configures Codex in `~/.codex/config.toml` (MCP servers, skill enablement).
  - Pros: Cross-platform, one command via `npm exec`/`pnpm dlx`, versioned updates.
  - Cons: Requires Node, needs permission to edit user config files.
- Option B: Shell/Python bootstrap script plus Homebrew/apt packaging.
  - Pros: Minimal dependencies.
  - Cons: Multi-platform complexity, harder to update.
- Option C: Repository-based setup script (e.g., `scripts/setup.sh`).
  - Pros: Simple for repo users.
  - Cons: Not one-click for non-repo users.

**Selected**: Option A - best aligns with PNPM/NPM preference and one-command bootstrap.

## Open Questions
- What exact Codex skill directory or config do you use today?
- Which shells/terminals need support (zsh, bash, fish, PowerShell)?
- Should the installer modify `~/.claude/settings.json` to wire hooks automatically?
- Do you want auto session logging always on, or opt-in per project?
- Any constraints on using Node/NPM vs Python/Bash?
