# Changelog

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
