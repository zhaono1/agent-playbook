# Technical Design: Agent Playbook One-Click Setup and Skill Workflow Fixes

> Status: Historical technical design / partially implemented
> Last updated: 2026-01-20 16:39

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
- Merge into `~/.claude/settings.json` or `.claude/settings.json`.
- Add hook entries for:
  - `SessionEnd`: run local CLI path with `session-log` and `transcript_path` from stdin.
  - `PostToolUse`: run local CLI path with `self-improve` (MVP: record metadata only).
- Install a local CLI copy under `.claude/agent-playbook/` to keep hook commands stable without relying on global PATH.
- Ensure hooks are merged without overwriting user-defined hooks.

### Codex Config
- Read and update `~/.codex/config.toml`.
- Optional: add `[[skills.config]]` to disable/enable default skills.
- Do not overwrite user settings; only append/update relevant blocks.

### Session Logging
- Parse `transcript_path` JSONL, extract summary, decisions, files, and commands.
- Write to `sessions/YYYY-MM-DD-{topic}.md` using the existing template.
- Support `--session-dir` for global vs repo logs.

### Self-Improvement MVP
- On PostToolUse/SessionEnd:
  - Append a bounded metadata entry into `~/.claude/memory/episodic/`.
  - Update working-memory state under `~/.claude/memory/working/`.
- Optional future enhancement: LLM summarization and pattern extraction.

## Migration Plan
- If existing links/configs are detected, do a no-op unless `--repair` is used.
- Back up any config file before modification.
- Provide `uninstall` to remove links and restore backups.
