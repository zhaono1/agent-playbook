---
name: session-logger
description: Save a bounded, redacted session summary when the user asks to record a conversation or when a supported host provides an explicit session-end transcript event.
allowed-tools: Read, Write
---

# Session Logger

Create a compact recovery artifact without treating raw conversation history as
durable memory.

## Use This Skill When

- The user explicitly asks to save or record the current session.
- A supported host invokes the Agent Playbook `SessionEnd` hook with a transcript path.
- A later task needs a concise handoff artifact and the user has authorized writing it.

Do not silently persist raw transcripts, credentials, private customer data, or
unbounded agent output. Host support and write authority must be visible; skill
metadata alone does not execute a hook.

## CLI Runtime Contract

Claude Code installation can invoke:

```bash
agent-playbook session-log
```

The command reads the host-provided JSONL transcript and stores only bounded,
redacted details:

- message counts;
- the last user prompt, truncated after redaction;
- up to 12 detected commands and file references;
- up to 8 detected questions;
- a hashed session reference and project identity.

By default, files are private local artifacts:

```text
~/.agent-playbook/sessions/<project-id>/YYYY-MM-DD-<topic>.md
```

Set `AGENT_PLAYBOOK_DATA_DIR` or pass `--data-dir` to move the private data root.
Writing inside a repository is opt-in only:

```bash
apb session-log --session-dir ./sessions
```

If a repository-local directory is selected, verify its ignore and retention
policy before writing. Never assume another repository ignores `sessions/`.

## Manual Summary Contract

When the host cannot provide a transcript event, create a user-authorized
summary from the context actually visible in the current session. Include only:

1. outcome and current state;
2. decisions that affect future work;
3. relevant files or commands;
4. open questions and next proof gate.

State omissions honestly. Do not claim full conversation capture, structured
decision extraction, automatic append behavior, or cross-session recall unless
the active runtime demonstrably provides it.

## Privacy and Safety

- Redact common credentials, bearer tokens, private keys, email addresses, and
  password/secret assignments before writing.
- Replace the current project root with a project identity in generated metadata.
- Write generated summaries with owner-only permissions where the platform supports it.
- Keep the artifact local unless the user separately authorizes commit, upload, or sharing.
- Treat redaction as risk reduction, not a guarantee that arbitrary confidential text is safe.

## Completion Check

- [ ] Destination and write authority are clear.
- [ ] The summary is bounded and contains no known raw secret.
- [ ] Repository-local storage was explicitly selected and ignore policy checked.
- [ ] The returned path exists and is readable by the user.
