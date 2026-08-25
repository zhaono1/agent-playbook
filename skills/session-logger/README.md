# Session Logger

Creates bounded, redacted session summaries for supported host hooks or explicit
manual capture.

The CLI defaults to private storage:

```text
~/.agent-playbook/sessions/<project-id>/YYYY-MM-DD-<topic>.md
```

Repository-local storage is opt-in with `--session-dir`; verify that project's
ignore and retention policy before using it. See [SKILL.md](./SKILL.md) for the
runtime, privacy, and manual-summary contracts.
