# Self-Improving Agent

A bounded, redacted learning lifecycle for agent workflows. It separates observation
from durable behavior change:

```text
failure/correction -> candidate -> validated -> applied -> superseded/rollback
```

## What Is Implemented

- Claude Code failure-hook capture without storing raw tool input or output
- Redaction, bounded event records, stable candidate fingerprints, and deduplication
- Explicit review states: `candidate`, `validated`, `applied`, `rejected`, `superseded`, and `rolled_back`
- Executable behavior eval artifacts plus an owner/change reference before application
- Markdown export for Obsidian or another local knowledge notebook
- Executable CLI tests plus human-scored scenario eval specifications in `evals/`

## Quick Start

Install skills and explicitly enable the Claude failure hook:

```bash
pnpm dlx @codeharbor/agent-playbook init --hooks
```

Capture a manual lesson:

```bash
apb self-improve capture \
  --kind correction \
  --summary "Verify the current source before relying on cached state" \
  --evidence "focused-test"
```

Review the queue, run the behavior eval, then record application only after the owner changes:

```bash
apb behavior inbox
apb behavior owners cand-123 --repo .
apb behavior eval cand-123 --artifact behavior-eval.json
apb behavior review cand-123 \
  --decision validate \
  --reason "confirmed by a representative test" \
  --eval-result /path/printed/by/the/eval/command.json

apb behavior proposal cand-123 \
  --owner "skill:self-improving-agent" \
  --output behavior-proposal.md

apb self-improve review cand-123 \
  --decision apply \
  --reason "installed in the durable owner" \
  --owner "skill:self-improving-agent" \
  --change-ref "commit:abc123"
```

Export to a knowledge notebook:

```bash
apb self-improve export --output /path/to/vault/Agent/Learning.md
```

State defaults to `~/.agent-playbook/self-improvement/`. Set
`AGENT_PLAYBOOK_DATA_DIR` to use another local root.

## Safety Model

Automatic capture is limited to failed tool events. It stores a redacted summary
and generic evidence label, not a transcript or raw tool payload. A candidate
cannot become an applied rule without a passing executable eval and an explicit
owner/change reference. Raw eval stdout and stderr are not persisted.

Run `apb conformance` after installation to distinguish locally proven files and
hook structure from host discovery or runtime invocation that has not been observed.

See [learning-lifecycle.md](./references/learning-lifecycle.md) for data and host
adapter contracts.
