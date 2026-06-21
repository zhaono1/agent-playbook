# Auto-Trigger

> Configuration skill that documents follow-up hook metadata between skills.

## Installation

This skill is part of the [agent-playbook](../../README.md) collection.

## Usage

This is a configuration skill and is **not** intended for direct invocation.

Typical usage is through `workflow-orchestrator`, which reads the hook definitions from this skill and records or runs supported follow-up actions.

## Example

```
# In another skill's front matter
hooks:
  after_complete:
    - trigger: session-logger
      mode: auto
```
