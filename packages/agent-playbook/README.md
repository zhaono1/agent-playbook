# @codeharbor/agent-playbook

Local-first Behavior CI and skill lifecycle for Claude Code, Codex, Gemini, and
DeepSeek Harness.

## Quick Start

```bash
pnpm dlx @codeharbor/agent-playbook init
# or
npm exec -- @codeharbor/agent-playbook init
```

Fresh installs leave Claude hooks disabled. Enable private session summaries and
failure capture explicitly:

```bash
pnpm dlx @codeharbor/agent-playbook init --hooks
```

Project-only setup:

```bash
pnpm dlx @codeharbor/agent-playbook init --project
```

## What It Does

- Installs skills to Claude Code, Codex, Gemini, and DeepSeek Harness directories.
- Optionally installs Claude Code hooks for bounded, redacted private session summaries and failure capture with `--hooks`.
- Manages skill lifecycle through `apb skills ...`.
- Captures deduplicated learning candidates without raw tool payloads.
- Requires structured evidence before validation and an owner/change reference before application.
- Prioritizes corrections in a Behavior Inbox, suggests durable owners, and
  generates reviewable local Behavior Change Proposals.
- Reports local-static host conformance without claiming unobserved discovery or
  runtime invocation.
- Exports applied rules and open candidates as Markdown for Obsidian or other local notebooks.

## Platform Support

| Platform | Local distribution | Lifecycle adapter | Host runtime |
|---|---|---|---|
| Claude Code | Skill files | Optional SessionEnd and PostToolUseFailure hooks | Unverified until observed |
| Codex | Skill files and local metadata marker | None | Unverified until observed |
| Gemini | Skill files | None | Unverified until observed |
| DeepSeek Harness | Skill files | None | Unverified until observed |

## Commands

```text
agent-playbook init [--project] [--copy] [--overwrite] [--hooks] [--no-hooks]
agent-playbook status|doctor|conformance|repair|uninstall
agent-playbook session-log [--session-dir <path>]
agent-playbook self-improve [capture] [--kind <kind>] [--summary <text>]
agent-playbook self-improve list [--status <status>] [--format json]
agent-playbook self-improve eval <id> --artifact <eval.json> [--format json]
agent-playbook self-improve review <id> --decision <validate|apply|observe|reject|supersede|rollback> --reason <text>
agent-playbook self-improve export --output <markdown-file>
agent-playbook behavior [inbox|capture|owners|eval|review|proposal|export]
agent-playbook skills [list|info|add|remove|enable|disable|doctor|sync|upgrade|export|import]
```

`apb` is a short alias for `agent-playbook`.

## Examples

```bash
apb skills list --scope both --target all
apb skills add ./skills/my-skill --scope project --target deepseek
apb conformance --format json

apb self-improve capture \
  --kind correction \
  --summary "Verify the current source before relying on cached state" \
  --evidence "focused-test"

apb behavior inbox
apb behavior owners cand-... --repo .
apb behavior eval cand-... --artifact behavior-eval.json

apb behavior review cand-... \
  --decision validate \
  --reason "representative regression passes" \
  --eval-result /path/to/eval-result.json

apb behavior proposal cand-... \
  --owner "skill:self-improving-agent" \
  --output behavior-proposal.md

apb self-improve review cand-... \
  --decision apply \
  --reason "durable owner changed and regression reran" \
  --owner "skill:self-improving-agent" \
  --change-ref "commit:abc123"

apb self-improve export --output /path/to/vault/Agent/Learning.md
```

## Local State and Privacy

Learning state defaults to `~/.agent-playbook/self-improvement/`; session
summaries default to `~/.agent-playbook/sessions/<project-id>/`. Hook installation
is opt-in with `--hooks`. Automatic
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
