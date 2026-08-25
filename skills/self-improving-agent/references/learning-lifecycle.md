# Learning Lifecycle Reference

## State Model

```text
event -> candidate -> validate -> apply -> supersede | rollback
                  \-> observe | reject
```

- Events are bounded and redacted evidence envelopes, not transcripts.
- Candidates group identical reusable summaries by fingerprint.
- Observation adds review evidence without changing active behavior.
- Validation requires a passing executable eval result for the same candidate; it does not change active behavior.
- Application requires one durable owner and change reference, then projects one applied rule.
- Rejection prevents a disproved occurrence from being reused as the same candidate.

## Storage Contract

Default root: `~/.agent-playbook/self-improvement/`

```text
self-improvement/
├── candidates.json
├── active-rules.json
├── events/
│   └── YYYY-MM/
│       └── evt-*.json
└── evals/
    └── cand-*/
        └── eval-*.json
```

Event fields are bounded to `kind`, `summary`, `evidence`, `scope`, `source`,
timestamp, candidate id, and tool version. Raw prompts, transcript paths, tool
inputs, and tool outputs are intentionally excluded.

Candidate fields include a hash fingerprint, unique identity, lifecycle state,
occurrence count, bounded evidence list, validation/application records,
timestamps, and review history. Eval results store assertion outcomes and hashes,
not raw stdout or stderr. `active-rules.json` is a generated projection of
candidates in `applied` state, not a second source of truth.

Writes use a process lock plus a temporary file and same-directory rename so
concurrent capture does not lose updates and readers do not observe partial state.

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

`self-improve export` produces deterministic Markdown sections for applied rules
and open candidates. A scheduler may replace the same file in an Obsidian vault.
The vault copy is disposable; structured CLI state remains authoritative.

Example periodic command:

```bash
apb self-improve export --output "$VAULT_PATH/Agent/Learning.md"
```

Use the scheduler provided by the operating system or automation host. Keep the
vault path and scheduling policy outside the public skill.

## Validation and Application Review

Before `--decision validate`, answer:

1. What current evidence supports the candidate?
2. What representative task would fail if it were wrong?
3. Which single durable owner should change?
4. Is the rule portable and free of private context?
5. What executable artifact proves the baseline and candidate behavior?

If any answer is missing, use `observe` rather than `validate`. Run the artifact
with `self-improve eval`, then pass its successful result to `review --decision
validate --eval-result ...`. After the owner
actually changes, record `apply --owner ... --change-ref ...`; never infer
application from validation alone.
