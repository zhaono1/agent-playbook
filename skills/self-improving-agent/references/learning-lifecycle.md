# Learning Lifecycle Reference

## State Model

```text
event -> candidate -> observe | reject | promote -> active rule
```

- Events are privacy-safe evidence envelopes, not transcripts.
- Candidates group identical reusable summaries by fingerprint.
- Observation adds review evidence without changing active behavior.
- Promotion requires explicit validation and writes one active rule.
- Rejection prevents a disproved occurrence from being reused as the same candidate.

## Storage Contract

Default root: `~/.agent-playbook/self-improvement/`

```text
self-improvement/
├── candidates.json
├── active-rules.json
└── events/
    └── YYYY-MM/
        └── evt-*.json
```

Event fields are bounded to `kind`, `summary`, `evidence`, `scope`, `source`,
timestamp, candidate id, and tool version. Raw prompts, transcript paths, tool
inputs, and tool outputs are intentionally excluded.

Candidate fields include a stable hash fingerprint, lifecycle state, occurrence
count, bounded evidence list, timestamps, and review history. Active rules keep
the candidate id and validation reason for traceability.

Writes use a temporary file and rename in the same directory so readers do not
observe partially written state.

## Host Adapter Contract

A host adapter may submit an event only when it can provide:

```json
{
  "hook_event_name": "PostToolUseFailure",
  "tool_name": "Bash",
  "error": "bounded error summary",
  "cwd": "/current/workspace"
}
```

Adapters send JSON on stdin to `agent-playbook self-improve`. The core decides
whether a reusable signal exists and applies redaction. Hosts without a reliable
failure event should use explicit manual capture instead of scraping transcripts.

## Knowledge Sink Contract

`self-improve export` produces deterministic Markdown sections for active rules
and open candidates. A scheduler may replace the same file in an Obsidian vault.
The vault copy is disposable; structured CLI state remains authoritative.

Example periodic command:

```bash
apb self-improve export --output "$VAULT_PATH/Agent/Learning.md"
```

Use the scheduler provided by the operating system or automation host. Keep the
vault path and scheduling policy outside the public skill.

## Promotion Review

Before `--validated`, answer:

1. What current evidence supports the candidate?
2. What representative task would fail if it were wrong?
3. Which single durable owner should change?
4. Is the rule portable and free of private context?
5. What command or review proves the behavior after promotion?

If any answer is missing, use `observe` rather than `promote`.
