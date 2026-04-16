# Long Task Coordinator Reference

## Detailed workflow

### 1. Decide whether coordination is necessary

Use long-task coordination when the task:
- Will outlive the current turn
- Has meaningful risk if chat context is lost
- Depends on delegated work or background execution
- Needs explicit checkpoints or waiting states

If none of those are true, a simpler planning pattern is usually enough.

### 2. Create a durable state file

Use a path that is easy to rediscover and consistent with the workspace, for example:

- `docs/<topic>-execution-plan.md`
- `docs/<topic>-state.md`
- `worklog/<topic>-state.md`

Recommended template:

```markdown
# Task State: <topic>

## Goal
<one sentence>

## Success criteria
- <criterion 1>
- <criterion 2>

## Status
running

## Current step
<what is actively happening now>

## Completed
- <completed item>

## Active owners
- Coordinator: <name or role>
- Worker: <name or role, if any>

## Blockers
- <blocker or "None">

## Next action
<next bounded action>

## Next checkpoint
<time, condition, or trigger>

## Notes
- <important recovery detail>
```

## Recovery checklist

Before taking new action:

1. Read the saved state file
2. Confirm the recorded status is still accurate
3. Check whether delegated work has returned
4. Decide whether to continue waiting, retry, re-dispatch, pause, or complete
5. Remove stale assumptions before new work begins

## Role model

### Origin

Owns the task definition and acceptance criteria.

### Coordinator

Owns the state file, sequencing, recovery, and reporting.

### Worker

Owns bounded execution work only. A worker should not redefine the task state for the whole system unless explicitly assigned that responsibility.

### Watchdog

Owns liveness checks only. It does not make domain decisions.

## Meaningful progress test

A non-terminal round must do at least one of the following:

- Dispatch new bounded work
- Consume a returned result
- Update the status or current decision
- Save a new next step or checkpoint
- Perform recovery and correct the state

If none of those happened, the round did not make real progress.

## Reporting rule

Always report from the persisted state, not from transient reasoning. A good status update mirrors the saved file:

- Current status
- What changed
- What is next
- What is blocked or waiting

## Completion checklist

Use this checklist before closing a task or round:

- [ ] The state file exists and is current
- [ ] The saved status is one of `running`, `awaiting-result`, `paused`, `blocked`, or `complete`
- [ ] Completed work is recorded
- [ ] The next action or completion note is recorded
- [ ] Delegated owners and checkpoints are captured where relevant
- [ ] The external report matches the saved state

## Portable design principles

- Make facts retrievable from files
- Keep reusable methods in skills
- Keep only stable constraints always-on
- Prefer small, focused reference files over large monoliths
