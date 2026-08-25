# Self-Improving Agent

A privacy-safe learning lifecycle for agent workflows. It separates observation
from durable behavior change:

```text
failure/correction -> candidate -> validation -> promoted rule or rejection
```

## What Is Implemented

- Claude Code failure-hook capture without storing raw tool input or output
- Redaction, bounded event records, stable candidate fingerprints, and deduplication
- Explicit review states: `candidate`, `promoted`, and `rejected`
- A `--validated` gate before promotion
- Markdown export for Obsidian or another local knowledge notebook
- Executable CLI tests plus scenario evals in `evals/`

## Quick Start

Install skills and the Claude failure hook:

```bash
pnpm dlx @codeharbor/agent-playbook init
```

Capture a manual lesson:

```bash
apb self-improve capture \
  --kind correction \
  --summary "Verify the current source before relying on cached state" \
  --evidence "focused-test"
```

Review the queue and promote only after validation:

```bash
apb self-improve list
apb self-improve review cand-123 \
  --decision promote \
  --reason "confirmed by a representative test" \
  --validated
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
cannot become an active rule without an explicit review reason and `--validated`.

See [learning-lifecycle.md](./references/learning-lifecycle.md) for data and host
adapter contracts.
