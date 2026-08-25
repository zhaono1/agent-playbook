# PRD: Comprehensive Local Skill Manager (apb)

> Status: Historical plan / partially implemented
> Last updated: 2026-01-21

## Table of Contents
- [Problem Statement](#problem-statement)
- [Goals and Non-Goals](#goals-and-non-goals)
- [Success Criteria](#success-criteria)
- [Scope](#scope)
- [User Personas](#user-personas)
- [Options Considered](#options-considered)
- [Requirements](#requirements)
- [Command Design](#command-design)
- [User Flows](#user-flows)
- [Data Model and Storage](#data-model-and-storage)
- [Conflict and Upgrade Policy](#conflict-and-upgrade-policy)
- [Backward Compatibility](#backward-compatibility)
- [Risks and Open Questions](#risks-and-open-questions)
- [Milestones](#milestones)

---

## Problem Statement
Managing skills across project and global scopes is currently manual, error-prone, and inconsistent. Users need a local-only CLI that can list, add, remove, enable/disable, validate, and upgrade skills across Claude Code, Codex, and Gemini, while safely handling duplicates and preserving user-created skills.

## Goals and Non-Goals
### Goals
- Provide a single CLI (short alias + full name) to manage all local skills.
- List all skills across project and global scopes (Claude + Codex + Gemini).
- Add/remove/enable/disable skills with safe conflict handling.
- Support local-only upgrades and synchronization.
- Maintain an auditable state file for managed skills.
- Run offline, with no remote registry or network dependency.

### Non-Goals
- Remote skill marketplace or auto-download from the internet.
- Editing or generating skill content automatically.
- GUI/TUI for management (CLI only).
- Centralized analytics/telemetry.

## Success Criteria
- Users can list all skills (project + global) in < 1 second on a typical repo.
- `skills add/remove/enable/disable` works for Claude, Codex, and Gemini targets.
- Conflicts are always detected; non-interactive runs never overwrite by default.
- Upgrades never delete existing session logs or memory entries.
- `skills doctor` identifies broken links, missing files, and duplicates.

## Scope
### In Scope
- CLI alias `apb` (Agent PlayBook) in addition to `agent-playbook`.
- `apb skills` management commands for local skills only.
- Scanning: `.claude/skills`, `.codex/skills`, `.gemini/skills`, `~/.claude/skills`, `~/.codex/skills`, `~/.gemini/skills`.
- State tracking for managed skills.
- Conflict resolution prompts + `--overwrite` escape hatch.

### Out of Scope
- Remote fetch (`npm`, `git`, URL) for `skills add`.
- Cloud sync or cross-device profiles.
- Editing the contents of skill files.

## User Personas
- **Power user**: Maintains multiple repos and wants a single CLI to keep skills in sync.
- **Project maintainer**: Wants project-specific skills without touching global setup.
- **Team member**: Needs a reproducible local setup without remote dependencies.

## Options Considered
1. **Minimal list-only**: Provide `skills list` without state management.  
2. **Managed local**: Track managed skills with a state file.  
3. **Comprehensive local manager (Selected)**: Full local lifecycle (list/add/remove/enable/disable/doctor/sync/upgrade/export/import).

**Selected**: Option 3, as requested for comprehensive local management.

## Requirements
### Functional Requirements
1. **CLI alias**
   - Provide `apb` as a short alias for `agent-playbook`.

2. **List skills**
   - `apb skills list [--scope project|global|both] [--target claude|codex|gemini|all] [--format table|json]`.
   - Output includes name, scope, target, source path, install mode (link/copy), and status (ok/broken/duplicate/disabled).

3. **Add skills (local only)**
   - `apb skills add <name|path> [--scope project|global] [--target claude|codex|gemini|all] [--copy|--link] [--overwrite]`.
   - `<name>` resolves to packaged built-in skills; `<path>` must contain `SKILL.md`.
   - Interactive conflict prompt when a target path already exists.

4. **Remove skills**
   - `apb skills remove <name> [--scope ...] [--target ...] [--force]`.
   - Removes link/copy created by the tool; warns if skill is unmanaged.

5. **Enable/disable**
   - `apb skills disable <name>` moves skill to a local disabled cache folder.
   - `apb skills enable <name>` restores from disabled cache.

6. **Doctor and fix**
   - `apb skills doctor` reports:
     - Broken symlinks
     - Missing `SKILL.md`
     - Duplicate skill names across scopes
     - Unmanaged skills present in managed paths
   - `apb skills doctor --fix` repairs links and updates state.

7. **Sync and upgrade**
   - `apb skills sync` reconciles state file with disk.
   - `apb skills upgrade` re-applies skills from the bundled local skills directory or a `--source <path>` override.

8. **Export/import**
   - `apb skills export --output <file>` dumps the state file for sharing.
   - `apb skills import <file> [--dry-run]` applies state locally.

9. **Info**
   - `apb skills info <name>` shows all copies/locations and metadata.

### Non-Functional Requirements
- Cross-platform: macOS + Linux; Windows best-effort.
- Safe defaults: no overwrite in non-interactive mode.
- Offline-first: no network access.
- Idempotent commands: repeated runs do not duplicate entries.

## Command Design
| Command | Description |
|---------|-------------|
| `apb skills` | Alias for `apb skills list` |
| `apb skills list` | Show skills across scopes/targets |
| `apb skills add` | Add skill by name or local path |
| `apb skills remove` | Remove managed skill |
| `apb skills enable` | Restore disabled skill |
| `apb skills disable` | Disable a skill locally |
| `apb skills doctor` | Detect issues |
| `apb skills doctor --fix` | Repair issues |
| `apb skills sync` | Reconcile state vs disk |
| `apb skills upgrade` | Re-apply local bundled skills |
| `apb skills export/import` | Share or restore state |
| `apb skills info` | Detailed metadata per skill |

## User Flows
### 1) List skills
1. User runs `apb skills list --scope both --target all`.
2. CLI scans project + global directories across Claude/Codex/Gemini.
3. Output table includes status and duplicates.

### 2) Add local skill
1. User runs `apb skills add /path/to/skills/my-skill --scope project`.
2. CLI validates `SKILL.md`.
3. If target exists, prompt to overwrite.
4. State is updated with source path and install mode.

### 3) Disable/enable
1. User runs `apb skills disable my-skill`.
2. CLI moves skill to `.../skills/.disabled/my-skill`.
3. State marks it as disabled.
4. `apb skills enable my-skill` reverses the move.

### 4) Upgrade
1. User runs `apb skills upgrade`.
2. CLI uses bundled local skills directory (or `--source`) to refresh managed skills.
3. Existing logs and memory are untouched.

## Data Model and Storage
**State file (local only):**
- Default path: `~/.agent-playbook/state.json`
- Contains managed skill metadata for Claude, Codex, Gemini, and DeepSeek Harness.
- Project entries include a private hash of the canonical project identity.

Example:
```json
{
  "version": "2",
  "updated_at": "2026-01-21T00:00:00Z",
  "skills": [
    {
      "name": "skill-router",
      "source": "/Users/me/agent-playbook/skills/skill-router",
      "scope": "global",
      "project_id": "global",
      "target": "claude",
      "mode": "link",
      "disabled": false,
      "managed_by": "apb",
      "installed_at": "2026-01-21T00:00:00Z"
    }
  ]
}
```

## Conflict and Upgrade Policy
### Duplicates and overwrites
- Interactive mode prompts once: “Overwrite all existing skills?”
- Non-interactive mode skips overwriting unless `--overwrite` is set.
- `skills doctor` reports duplicates across scopes.

### Upgrade safety
- `skills upgrade` never removes session logs or memory.
- `skills sync` preserves unmanaged skills unless explicitly removed.
- Logs include `Agent Playbook Version` metadata.

## Backward Compatibility
- Existing `agent-playbook` commands remain unchanged.
- New `apb` alias maps to the same CLI binary.
- State file is additive and optional.

## Risks and Open Questions
- How to represent “disabled” for Codex/Gemini vs Claude consistently?
- Should `skills enable/disable` operate per target or per scope by default?
- Should we support multiple state files (per-project) in addition to global?

## Milestones
1. **M1**: Command scaffolding + `skills list/info`.
2. **M2**: `skills add/remove` with state tracking.
3. **M3**: `skills doctor/sync/upgrade`.
4. **M4**: `skills enable/disable` + export/import.
