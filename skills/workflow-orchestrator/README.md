# Workflow Orchestrator

> A skill that interprets declarative follow-up metadata without assuming the
> host executes it automatically.

## Installation

This skill is part of the [agent-playbook](../../README.md) collection.

## Usage

```
You: Complete workflow
You: Finish the process and trigger next steps
```

## How It Works

- Reads hook definitions from `skills/auto-trigger/SKILL.md`
- Records or runs supported follow-up actions based on `auto`, `background`, or `ask_first` modes
- Uses `session-logger` only when the host supports it and local capture is appropriate

Hook metadata describes intent. The Agent Playbook CLI does not provide a
general workflow engine that automatically executes these chains.
