# Changelog

## 0.4.2 - 2026-08-25

### Added

- Executable baseline/candidate Eval Artifacts with bounded command execution,
  private hash-only results, and validation gates that reject failed evaluations
- An independently tested self-improvement core module and eval runner
- A Behavior Inbox, local durable-owner suggestions, and reviewable Behavior
  Change Proposal generation
- A local-static `apb conformance` report that separates proven distribution and
  configuration from unsupported or unverified host-runtime capabilities

### Changed

- Fresh installs now leave Claude hooks disabled unless users explicitly pass
  `--hooks`; `--no-hooks` removes previously managed hooks and their local runtime
- Candidate validation now requires a passing executable eval result for the same
  candidate instead of free-form evidence strings
- Claude hooks now use the documented command-plus-args form without a shell
- Eval commands inherit a minimal platform environment instead of arbitrary
  parent-process credentials

### Fixed

- Preserve TOML array tables that follow legacy Agent Playbook metadata
- Restrict stale skill-state removal to the active project, scope, and target
- Reject tampered eval summaries and eval-result symlink escapes; escape
  hook-derived Markdown and HTML in generated Behavior Change Proposals

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
