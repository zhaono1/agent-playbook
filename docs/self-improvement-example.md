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

Create a JSON Eval Artifact with baseline and candidate scenarios. The command
array, working directory, timeout, and expected exit/output assertions are
explicit and reviewable. See
[`eval-artifact.md`](../skills/self-improving-agent/references/eval-artifact.md).

## 4. Validate, Then Apply Explicitly

```bash
apb self-improve eval cand-... --artifact behavior-eval.json

apb self-improve review cand-... \
  --decision validate \
  --reason "representative regression test passes" \
  --eval-result /path/printed/by/the/eval/command.json
```

The eval result stores assertion outcomes and hashes without raw stdout/stderr.
Validation records this executable proof but does not change Agent behavior. Update the one
durable owner, rerun the representative check, then record the application:

```bash
apb self-improve review cand-... \
  --decision apply \
  --reason "durable owner updated and regression rerun" \
  --owner "skills/example/SKILL.md" \
  --change-ref "commit-or-pr-reference"
```

Only applied candidates appear in the derived active-rule projection. The CLI
does not automatically edit every skill, and applied changes can later be
superseded or rolled back.

## 5. Export to a Knowledge Notebook

```bash
apb self-improve export --output /path/to/vault/Agent/Learning.md
```

The exported Markdown is suitable for Obsidian search and backlinks. Structured
candidate state under `~/.agent-playbook/self-improvement/` remains authoritative.

## Automatic Failure Capture

`apb init --hooks` explicitly installs a Claude Code `PostToolUseFailure` hook.
Fresh installs leave hooks disabled. When enabled, the hook sends the failure
event to the same capture command. Redaction occurs before local storage, and a
failure never validates or applies itself.
