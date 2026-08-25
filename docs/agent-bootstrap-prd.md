# PRD: Agent Playbook One-Click Setup and Skill Workflow Fixes

> Status: Historical plan / partially implemented
> Last updated: 2026-01-20 16:39
> Superseded for self-improvement and host support by
> [Integrations and Product Roadmap](./integrations-and-product-roadmap.md) and
> [Self-Improvement Example](./self-improvement-example.md).

## Table of Contents
- [Problem Statement](#problem-statement)
- [Goals and Non-Goals](#goals-and-non-goals)
- [Success Criteria](#success-criteria)
- [Scope](#scope)
- [Requirements](#requirements)
- [User Flows](#user-flows)
- [Implementation Plan](#implementation-plan)

---

## Problem Statement
Agent-playbook requires manual, inconsistent setup across Claude Code and Codex. Skills live in different global folders, terminal environments vary, and the current workflow automation (session logging and self-improvement) does not run because hooks are not wired by default. Users need a one-command installer that standardizes skill placement, configures hooks safely, and provides diagnostics to keep the setup working.

## Goals and Non-Goals
### Goals
- Provide a one-command installer using PNPM or NPM.
- Make skills available in both Claude Code and Codex with consistent structure.
- Enable reliable session logging and self-improvement triggers via hooks.
- Provide a doctor/repair workflow that detects and fixes drift.
- Preserve existing user config and avoid destructive changes.

### Non-Goals
- Rebuild Claude Code or Codex functionality.
- Replace manual skill authoring or create new skills beyond setup tooling.
- Implement a full UI or GUI installer.
- Enforce enterprise policies or managed hooks.

## Success Criteria
- A new user can run a single command (e.g., `pnpm dlx ... init`) and complete setup in under 3 minutes.
- Skills are discoverable by both Claude Code and Codex without manual path edits.
- Session logs are generated automatically after a session ends.
- The self-improvement pipeline records at least one usable memory artifact per session (MVP).
- `agent-playbook doctor` reports no critical issues on a clean install.

## Scope
### In Scope
- A cross-platform CLI installer distributed via NPM/PNPM.
- Skill linking/syncing to `~/.claude/skills` and `~/.codex/skills` (and optional repo scopes).
- Safe merge of Claude Code hooks in `~/.claude/settings.json` or `.claude/settings.json`.
- Codex config discovery and optional updates in `~/.codex/config.toml`.
- Session logging based on Claude SessionEnd hooks using `transcript_path`.
- A doctor/repair command and an uninstall command.

### Out of Scope
- Networked skill marketplace or in-app discovery UI.
- Automated skill quality scoring.
- Multi-user enterprise policy management.

## Requirements
### Functional Requirements
1. CLI commands:
   - `init`: install and configure.
   - `doctor`: validate setup.
   - `repair`: fix known issues.
   - `status`: show current config and links.
   - `uninstall`: remove links and revert config changes (where safe).
2. Package name is `@codeharbor/agent-playbook`.
3. Install modes:
   - Global (default) and project-level (`--project` flag).
   - Symlink by default; fallback to copy when symlink fails.
4. Claude Code integration:
   - Add hooks in `settings.json` for SessionEnd and PostToolUse (minimal MVP for logging).
   - Support opt-in `--hooks` or `--no-hooks` flags.
5. Codex integration:
   - Detect `~/.codex/config.toml` and `~/.codex/skills`.
   - Support linking skills to user scope and/or repo `.codex/skills`.
6. Session logging:
   - On SessionEnd, read `transcript_path` and write `sessions/YYYY-MM-DD-{topic}.md`.
   - Allow `--session-dir` override.
7. Self-improvement MVP:
   - On SessionEnd or PostToolUse, append a structured memory entry (raw metadata) to `~/.claude/memory/`.
8. Safety:
   - Backup configs before modifying.
   - Idempotent re-runs without duplicate hooks or links.

### Non-Functional Requirements
- macOS and Linux support in v1; Windows best-effort with clear messaging.
- No destructive actions without confirmation; support `--dry-run`.
- All modifications are reversible by `uninstall`.
- Minimal external dependencies; no network needed after install.

## User Flows
1. One-click setup (global):
   - User runs `pnpm dlx @codeharbor/agent-playbook init`.
   - CLI detects Claude/Codex paths, applies links, adds hooks, and confirms.
2. Project-only setup:
   - User runs `agent-playbook init --project`.
   - CLI links skills into `.claude/skills` and `.codex/skills` within repo.
3. Diagnostics:
   - User runs `agent-playbook doctor` to validate config/hook/link status.
4. Repair:
   - User runs `agent-playbook repair` and approves changes.
5. Uninstall:
   - User runs `agent-playbook uninstall`, which removes links and restores backed-up configs.

## Implementation Plan
- Phase 1: CLI scaffolding and command routing.
- Phase 2: Claude Code integration (skills linking + hooks merge).
- Phase 3: Codex integration (skills linking + config discovery).
- Phase 4: Session logging pipeline + self-improvement MVP.
- Phase 5: Doctor/repair/uninstall, documentation updates.
- See `docs/agent-bootstrap-tech.md` for technical design.
