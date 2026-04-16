# Long Task Coordinator

Coordinate long-running work with explicit state, recovery rules, and honest status transitions.

## What this skill is for

`long-task-coordinator` is for work that should not depend on chat memory alone. It is useful when:

- A task spans multiple turns or sessions
- Work is delegated to subagents, background jobs, or automation
- The task needs checkpoints, retries, or waiting states
- A user may return later and ask to resume from the last known state

This skill is intentionally abstract and portable. It does not assume any specific business domain, toolchain, or runtime.

## Installation

```bash
ln -s /path/to/agent-playbook/skills/long-task-coordinator ~/.claude/skills/long-task-coordinator
ln -s /path/to/agent-playbook/skills/long-task-coordinator ~/.codex/skills/long-task-coordinator
ln -s /path/to/agent-playbook/skills/long-task-coordinator ~/.gemini/skills/long-task-coordinator
```

## Core loop

Every coordination round follows the same sequence:

```text
READ -> RECOVER -> DECIDE -> PERSIST -> REPORT -> END
```

The ordering matters. If you report before you persist, the next round cannot recover reliably.

## What gets persisted

At minimum, the state file should record:

- Goal
- Success criteria
- Current status
- Current step
- Completed work
- Next action
- Next checkpoint
- Blockers
- Owners or delegated workers

## Valid states

Use explicit status values instead of vague progress messages:

- `running`
- `awaiting-result`
- `paused`
- `blocked`
- `complete`

`awaiting-result` is important. If a worker was dispatched successfully, the task is waiting, not failing.

## Acceptance criteria

The skill has done its job when:

- A durable state file was created or updated
- The task status is explicit and truthful
- The next checkpoint is recorded
- Delegated work is tracked with clear ownership
- The progress report matches the persisted state

## Good use cases

### Example 1: Resumable research

An agent performs research across multiple turns, saving findings and next checkpoints in a shared state file so the work can resume later without reconstructing the thread.

### Example 2: Multi-agent delivery

One agent coordinates work, delegates bounded tasks to workers, records owner assignments and return conditions, then resumes when results arrive.

### Example 3: Scheduled follow-up

A long-running operational task checks a queue periodically, persists each checkpoint, and reports only from the saved state.

## Not the same as other skills

- Use `planning-with-files` for general file-based planning.
- Use `workflow-orchestrator` for hook-based skill chaining.
- Use `long-task-coordinator` when recovery and state transitions are the hard part.

## References

- [Detailed workflow](./references/workflow.md)
- [Eval prompts](./evals/prompts.md)
