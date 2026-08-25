# @codeharbor/agent-playbook

Local skill manager and validated learning lifecycle for Claude Code, Codex,
Gemini, and DeepSeek Harness.

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

- Installs skills to Claude Code, Codex, Gemini, and DeepSeek Harness directories.
- Installs Claude Code hooks for bounded, redacted private session summaries and failure capture.
- Manages skill lifecycle through `apb skills ...`.
- Captures deduplicated learning candidates without raw tool payloads.
- Requires structured evidence before validation and an owner/change reference before application.
- Exports applied rules and open candidates as Markdown for Obsidian or other local notebooks.

## Platform Support

| Platform | Skill install | Adapter automation | Status |
|---|---|---|---|
| Claude Code | Yes | SessionEnd and PostToolUseFailure hooks | Full |
| Codex | Yes | Metadata block only | Skill distribution |
| Gemini | Yes | None | Skill distribution |
| DeepSeek Harness | Yes | None | Skill distribution |

## Commands

```text
agent-playbook init [--project] [--copy] [--overwrite] [--hooks] [--no-hooks]
agent-playbook status|doctor|repair|uninstall
agent-playbook session-log [--session-dir <path>]
agent-playbook self-improve [capture] [--kind <kind>] [--summary <text>]
agent-playbook self-improve list [--status <status>] [--format json]
agent-playbook self-improve review <id> --decision <validate|apply|observe|reject|supersede|rollback> --reason <text>
agent-playbook self-improve export --output <markdown-file>
agent-playbook skills [list|info|add|remove|enable|disable|doctor|sync|upgrade|export|import]
```

`apb` is a short alias for `agent-playbook`.

## Examples

```bash
apb skills list --scope both --target all
apb skills add ./skills/my-skill --scope project --target deepseek

apb self-improve capture \
  --kind correction \
  --summary "Verify the current source before relying on cached state" \
  --evidence "focused-test"

apb self-improve review cand-... \
  --decision validate \
  --reason "representative regression passes" \
  --validation-method focused-test \
  --validation-evidence "test:self-improvement"

apb self-improve review cand-... \
  --decision apply \
  --reason "durable owner changed and regression reran" \
  --owner "skill:self-improving-agent" \
  --change-ref "commit:abc123"

apb self-improve export --output /path/to/vault/Agent/Learning.md
```

## Local State and Privacy

Learning state defaults to `~/.agent-playbook/self-improvement/`; session
summaries default to `~/.agent-playbook/sessions/<project-id>/`. Automatic
failure capture excludes raw prompts, transcripts, tool inputs, and tool
outputs. Session summaries store bounded redacted extracts and never default to
the current repository.

Override paths for testing or managed environments:

```bash
AGENT_PLAYBOOK_CLAUDE_DIR=/tmp/claude
AGENT_PLAYBOOK_CODEX_DIR=/tmp/codex
AGENT_PLAYBOOK_GEMINI_DIR=/tmp/gemini
AGENT_PLAYBOOK_DSH_DIR=/tmp/dsh
AGENT_PLAYBOOK_DATA_DIR=/tmp/agent-playbook-data
```

Requires Node.js 18+.
