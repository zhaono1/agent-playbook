---
name: self-improving-agent
description: Use after a failure, user correction, repeated workflow problem, or validated success reveals a reusable lesson. Captures privacy-safe candidates, tests them, and promotes only validated rules into durable guidance.
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
---

# Self-Improving Agent

Turn evidence from completed work into a small, auditable behavior change. The
default result is a candidate or no change—not an automatic rewrite of skills.

## Use This Skill When

- A tool or workflow failed in a way that may recur.
- The user corrected an assumption, requirement, or operating rule.
- The same workaround appeared more than once.
- A focused test proved a better reusable method.
- The user asks to review or consolidate learning candidates.

Do not use it for routine session summaries, raw transcript storage, speculative
ideas without evidence, or project facts that belong in project documentation.

## Required Outcome

Every run ends in exactly one state:

1. `candidate`: reusable but not yet validated.
2. `promoted`: validated and installed in the narrowest durable owner.
3. `rejected`: disproved, unsafe, too specific, or obsolete.
4. `no-delta`: no reusable behavior change was found.
5. `open-question`: evidence is insufficient and the missing proof is named.

An artifact is not proof of improvement. A promoted lesson must change future
behavior and have a representative check that demonstrates the change.

## Start Packet

Before editing durable guidance, state:

- Future behavior: what the agent should do differently next time.
- Representative task: one concrete scenario that should now succeed.
- Evidence: current source, failure output, user correction, or focused test.
- Owner: the one skill, instruction file, script, or runtime component that owns it.
- Write boundary: files allowed to change and information that must remain local.
- Proof: the command, eval, or review that confirms the new behavior.

If any item is unknown, capture a candidate and stop before promotion.

## Lifecycle

### 1. Capture the Signal

Prefer facts over interpretation. Record only the minimum reusable summary; do
not copy transcripts, tool inputs, credentials, private paths, or customer data.

Automatic Claude Code failure hooks can call:

```bash
agent-playbook self-improve
```

Manual corrections or successes use an explicit summary and evidence label:

```bash
apb self-improve capture \
  --kind correction \
  --summary "Verify the current source before relying on cached state" \
  --evidence "focused-test"
```

The CLI stores redacted events and deduplicated candidates under
`~/.agent-playbook/self-improvement/`. Override the root with
`AGENT_PLAYBOOK_DATA_DIR` or `--data-dir`.

### 2. Assess Reusability

Keep a candidate only when all are true:

- It describes future behavior, not just what happened.
- It is useful beyond one private task or repository.
- It does not conflict with a current authoritative source.
- A narrow owner and a realistic validation path exist.

Use `apb self-improve list` to inspect the queue. Repeated evidence increases
occurrence count; it does not automatically increase truth.

### 3. Validate

Choose the smallest proof that can falsify the candidate:

| Candidate | Minimum proof |
|---|---|
| Prompt or workflow rule | Representative prompt plus rubric |
| CLI/runtime behavior | Focused automated test |
| External integration | Live capability check against current docs/runtime |
| Safety rule | Negative test showing the unsafe path is blocked |
| Repeated heuristic | Multiple independent episodes or explicit human confirmation |

Separate facts, hypotheses, and missing evidence. Structural validation alone
does not prove that guidance is semantically current or executable by the host.

### 4. Promote or Reject

Promotion is explicit and requires both a reason and `--validated`:

```bash
apb self-improve review cand-123 \
  --decision promote \
  --reason "confirmed by the representative regression test" \
  --validated
```

Other decisions:

```bash
apb self-improve review cand-123 --decision observe --reason "needs a second episode"
apb self-improve review cand-123 --decision reject --reason "project-specific exception"
```

Promote into the narrowest owner:

1. Executable test, script, or validator when behavior can be enforced.
2. The owning skill or its reference when agent judgment is required.
3. Project instructions only for project-wide constraints.
4. A knowledge notebook for durable facts that should be retrieved, not always loaded.

Never silently modify repository rules, publish packages, or trigger external
actions as a side effect of capture.

### 5. Prove the Loop

Run the representative task after promotion. Report:

- candidate id and final state;
- evidence used and what remains uncertain;
- durable owner changed;
- validation command/result;
- rollback path.

If the new rule does not change the representative behavior, revert or reject it.

## Knowledge Export

Export active rules and open candidates as Markdown for Obsidian or another
local knowledge system:

```bash
apb self-improve export --output /path/to/vault/Agent/Learning.md
```

The export is a sink, not the source of truth. Candidate and active-rule state
remain structured and auditable in the CLI data directory.

## Host Boundary

Skills describe judgment; host adapters provide events and actions. Check the
current host before claiming support:

- Claude Code: deterministic failure hook installed by `apb init`.
- Codex, Gemini, DeepSeek Harness: skill distribution is supported; learning
  event wiring depends on each host's current extension API.
- Unsupported hooks must remain manual or adapter-specific, never simulated by
  undocumented behavior.

See `references/learning-lifecycle.md` for schemas and adapter contracts. Use
`evals/cases.json` with `evals/rubric.md` when changing this skill.

## Done Checklist

- [ ] Candidate/no-delta decision is explicit.
- [ ] Stored text is minimal, redacted, and portable.
- [ ] Current authoritative sources were checked when relevant.
- [ ] Promotion has explicit validation and one durable owner.
- [ ] Representative behavior was tested after promotion.
- [ ] No private project detail entered public skill assets.
