# Workflow Orchestrator

> A Claude Code skill that coordinates multi-skill workflows using hook definitions.

## Installation

This skill is part of the [agent-playbook](../../README.md) collection.

## Usage

```
You: Complete workflow
You: Finish the process and trigger next steps
```

## How It Works

- Reads hook definitions from `skills/auto-trigger/SKILL.md`
- Executes follow-up actions based on `auto`, `background`, or `ask_first` modes
- Logs progress and context to `session-logger`
