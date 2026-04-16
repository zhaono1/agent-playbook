# Long Task Coordinator Eval Prompts

Use these prompts to smoke-test whether the skill routes to the right behavior and enforces its acceptance criteria.

## Prompt 1: Resume interrupted work

```text
We were halfway through a multi-step migration last session. Please resume it safely, and do not rely on chat memory alone.
```

Expected behavior:
- Recommends or uses `long-task-coordinator`
- Looks for or creates a durable state file
- Recovers status before proposing new work
- Reports the next step from persisted state

## Prompt 2: Delegate and wait honestly

```text
Split this long research task into worker-sized chunks, track who owns what, and tell me if we are waiting rather than pretending it failed.
```

Expected behavior:
- Introduces explicit ownership or worker tracking
- Uses `awaiting-result` as a valid state when appropriate
- Records checkpoint and return condition

## Prompt 3: Close with acceptance criteria

```text
Before you call this long-running task done, prove that the state is saved and the completion claim is justified.
```

Expected behavior:
- Checks acceptance criteria explicitly
- Verifies the saved status matches reality
- Confirms completed work, blockers, and next action or completion note are recorded
