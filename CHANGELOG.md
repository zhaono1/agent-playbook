# Changelog

## 0.4.1 - 2026-08-25

### Added

- Fail-closed, atomic JSON persistence with write locks for shared CLI state
- Project-scoped state identities, legacy state migration, and ownership-safe
  uninstall behavior for both linked and copied skills
- Explicit `candidate -> validated -> applied -> superseded/rolled_back`
  learning lifecycle with auditable validation and application evidence
- Private, redacted session storage outside repositories by default
- Skill command smoke tests, multi-platform CLI CI, pinned GitHub Actions,
  Dependabot configuration, and a repository-level MIT license

### Changed

- Invalid skill scopes and targets now fail closed; unmanaged enable/disable
  operations require explicit `--force` adoption
- Codex TOML updates use a bounded marker block and preserve unrelated content
- `repair` and `upgrade` refresh the local hook runtime and report version drift
- MCP advertises only implemented tools, omits host filesystem paths, and tracks
  the Agent Playbook release version
- Skill guidance now uses portable host language, current OWASP Top 10:2025
  categories, explicit deployment authority, and executable command examples

### Fixed

- Candidate ID collisions, invalid state transitions, repeated applied-signal
  handling, corrupt-store overwrite risk, and concurrent mutation races
- Repeated init/uninstall ownership drift and accidental deletion of user-replaced
  skill directories

## 0.4.0 - 2026-08-25

### Added

- Validated self-improvement lifecycle with redacted failure capture, candidate
  deduplication, explicit review, active rules, and Markdown export
- DeepSeek Harness skill installation through `.dsh/skills`
- Scenario evals and lifecycle contracts for the self-improving agent
- Obsidian integration guidance and a productization roadmap

### Changed

- Claude Code self-improvement automation now listens only to
  `PostToolUseFailure` instead of recording every successful tool call
- Self-improvement state moved from Claude-specific memory paths to
  `~/.agent-playbook/self-improvement/`

### Removed

- Unused hook scripts, static memory samples, and templates that implied
  autonomous learning behavior not implemented by the runtime
