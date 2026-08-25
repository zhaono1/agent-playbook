# Self-Improvement Example

This example shows the implemented learning lifecycle. Capturing an event does
not modify a skill; it creates a candidate that must be validated first.

## 1. Capture a Correction

```bash
apb self-improve capture \
  --kind correction \
  --summary "Verify the current source before relying on cached state" \
  --evidence "focused-test"
```

Expected result:

```text
Learning candidate cand-... captured (1 occurrence(s)).
```

The stored event contains the bounded summary, evidence label, scope, and
timestamp. It does not contain a transcript or raw tool payload.

## 2. Review the Candidate

```bash
apb self-improve list
```

If evidence is incomplete, keep it under observation:

```bash
apb self-improve review cand-... \
  --decision observe \
  --reason "needs an independent reproduction"
```

Occurrence count is evidence volume, not a confidence score. Repeated bad data
does not make a candidate correct.

## 3. Validate Future Behavior

Define one representative task and a falsifiable check. Examples:

- a regression test for runtime behavior;
- a prompt plus rubric for workflow guidance;
- a live capability check for a host integration;
- explicit human confirmation for a policy correction.

Record the evidence outside the candidate summary when it contains private or
project-specific context.

## 4. Promote Explicitly

```bash
apb self-improve review cand-... \
  --decision promote \
  --reason "representative regression test passes" \
  --validated
```

Promotion writes a traceable active rule. It does not automatically edit every
skill. Update the one durable owner, rerun the representative check, and report
the rollback path.

## 5. Export to a Knowledge Notebook

```bash
apb self-improve export --output /path/to/vault/Agent/Learning.md
```

The exported Markdown is suitable for Obsidian search and backlinks. Structured
candidate state under `~/.agent-playbook/self-improvement/` remains authoritative.

## Automatic Failure Capture

`apb init` installs a Claude Code `PostToolUseFailure` hook. It sends the failure
event to the same capture command. Redaction occurs before local storage, and a
failure never promotes itself.
