# Technical Design: Agent Playbook One-Click Setup and Skill Workflow Fixes

> Status: Historical technical design / partially implemented
> Last updated: 2026-01-20 16:39
> Superseded for self-improvement and host support by
> [Integrations and Product Roadmap](./integrations-and-product-roadmap.md) and
> [Self-Improvement Example](./self-improvement-example.md).

## Overview
Deliver a Node-based CLI distributed via NPM/PNPM (`@codeharbor/agent-playbook`) that links skills into Claude Code and Codex locations, merges hook configuration safely, and installs hook scripts to enable session logging and self-improvement capture.

## Key Components
- CLI entrypoint (`agent-playbook`): command routing, prompts, and flags.
- Path resolver: detects repo root, Claude config (`~/.claude`), Codex config (`~/.codex`).
- Skill linker: creates symlinks (or copies) from `skills/` into target folders.
- Config writer:
  - JSON merge for Claude `settings.json` (hooks and metadata).
  - TOML merge for Codex `config.toml` (optional features and skill toggles).
- Hook scripts:
  - SessionEnd hook that reads `transcript_path` and writes session logs.
  - PostToolUse hook that records tool activity for self-improvement MVP.
- Doctor/repair engine: verifies links, hooks, and config integrity.

## API Design
### CLI Commands
- `agent-playbook init [--project] [--copy] [--hooks] [--no-hooks] [--session-dir <path>] [--dry-run]`
- `agent-playbook status`
- `agent-playbook doctor`
- `agent-playbook repair`
- `agent-playbook uninstall`

### Config Tracking
- Store a small marker in Claude settings, e.g.:
  - `agentPlaybook`: `{ "version": "x.y.z", "installedAt": "..." }`
- Keep backup files:
  - `~/.claude/settings.json.bak`
  - `~/.codex/config.toml.bak`

## Data Flow
1. `init` starts
2. Detect environment (paths, OS, shell)
3. Build plan (links + config + hooks)
4. Apply file operations (symlink/copy)
5. Merge config files
6. Verify and print summary

## Implementation Details
### Skill Linking
- Source: repo `skills/` folder.
- Targets:
  - Claude: `~/.claude/skills` or project `.claude/skills`.
  - Codex: `~/.codex/skills` or repo `.codex/skills`.
- Use symlinks by default; fallback to copy on Windows or permissions failure.
- Maintain a manifest file under `~/.claude/skills/.agent-playbook.json` to track ownership.

### Claude Hooks
- Fresh installs leave hook automation disabled; `--hooks` is explicit opt-in.
- Merge into `~/.claude/settings.json` or `.claude/settings.json`.
- Add hook entries for:
  - `SessionEnd`: run local CLI path with `session-log` and `transcript_path` from stdin.
  - `PostToolUseFailure`: run local CLI path with `self-improve` to capture a bounded candidate.
- Install a local CLI copy under `.claude/agent-playbook/` to keep hook commands stable without relying on global PATH.
- Ensure hooks are merged without overwriting user-defined hooks.

### Codex Config
- Read and update `~/.codex/config.toml`.
- Optional: add `[[skills.config]]` to disable/enable default skills.
- Do not overwrite user settings; manage only the explicit Agent Playbook marker block.

### Session Logging
- Parse `transcript_path` JSONL and extract bounded redacted prompts, files, commands, and questions.
- Default to `~/.agent-playbook/sessions/<project-id>/YYYY-MM-DD-{topic}.md`.
- Write inside a repository only when the user explicitly supplies `--session-dir`.

### Self-Improvement Lifecycle
- On `PostToolUseFailure`, write a bounded event and deduplicated candidate under
  `~/.agent-playbook/self-improvement/`.
- Require structured evidence before validation and a named owner/change reference
  before application.
- Treat `active-rules.json` as a derived projection of applied candidates.

## Migration Plan
- Preserve verified ownership across repeated init and repair operations.
- Back up any config file before modification.
- Provide `uninstall` to remove only resources whose ownership still verifies.
