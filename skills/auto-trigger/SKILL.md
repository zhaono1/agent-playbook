---
name: auto-trigger
description: Workflow hook metadata for agent-playbook skills. This skill documents trigger intent between skills - DO NOT use directly, and do not assume hooks execute unless the host runtime explicitly supports them.
allowed-tools: Read, Write, Edit
---

# Auto-Trigger Hooks

This skill defines trigger intent between skills. When a skill completes its
workflow, a host runtime or agent may read this metadata, record a pending
follow-up, and execute the next skill only when that action is supported and
safe for the current session.

## Hook Definitions

### PRD Creation Chain

```yaml
prd_complete:
  triggers:
    - skill: self-improving-agent
      mode: background
      condition: PRD file exists and is complete
    - skill: session-logger
      mode: auto
      context: "PRD created for {feature_name}"

prd_implemented:
  triggers:
    - skill: session-logger
      mode: auto
      context: "Implemented PRD: {feature_name}"
```

### Implementation Chain

```yaml
implementation_complete:
  triggers:
    - skill: code-reviewer
      mode: ask_first
      message: "Implementation complete. Run code review?"
    - skill: create-pr
      mode: ask_first
      condition: user_requested_submission
```

### Session Management

```yaml
session_start:
  auto_triggers:
    - skill: session-logger
      action: create_session_file

session_end:
  auto_triggers:
    - skill: session-logger
      action: update_session_file
```

## Hook Format in Skills

To add auto-trigger capability to a skill, add to its front matter:

```yaml
---
name: my-skill
description: Skill description
allowed-tools: Read, Write, Edit
hooks:
  before_start:
    - trigger: session-logger
      mode: auto
      context: "Start {skill_name}"
  after_complete:
    - trigger: self-improving-agent
      mode: background
    - trigger: session-logger
      mode: auto
  on_error:
    - trigger: self-improving-agent
      mode: background
---
```

## Implementation Guide

When a skill completes its workflow:

1. **Check `hooks`** in its own front matter (`before_start`, `after_complete`, `on_error`, `on_progress`)
2. **For each hook:**
   - If `mode: auto`, record or run a low-risk follow-up only when the host runtime supports it
   - If `mode: background`, record a non-blocking follow-up; do not mutate durable files silently
   - If `mode: ask_first`, ask user before triggering
   - If `condition:` exists, check it first
3. **Pass context** to the triggered skill

## Example Integration

### prd-planner should add:

```yaml
---
name: prd-planner
description: Creates PRDs using persistent file-based planning...
allowed-tools: Read, Write, Edit, Bash, Grep, Glob, AskUserQuestion, WebSearch
hooks:
  after_complete:
    - trigger: self-improving-agent
      mode: background
      context: "PRD created at {prd_file}"
    - trigger: session-logger
      mode: auto
      context: "PRD creation complete"
---
```

### self-improving-agent already has:

```yaml
---
name: self-improving-agent
description: Universal self-improvement that learns from all skill experiences...
allowed-tools: Read, Write,Edit, Bash, Grep, Glob, WebSearch
hooks:
  after_complete:
    - trigger: create-pr
      mode: ask_first
      condition: skills_modified
    - trigger: session-logger
      mode: auto
      context: "Self-improvement cycle complete"
  on_error:
    - trigger: self-improving-agent
      mode: background
---
```

### create-pr should add:

```yaml
---
name: create-pr
description: Creates pull requests with bilingual documentation updates...
allowed-tools: Read, Write, Edit, Bash, Grep, AskUserQuestion
hooks:
  after_complete:
    - trigger: session-logger
      mode: auto
      context: "PR created: {pr_title}"
---
```

## Chain Visualization

```
┌──────────────┐
│ prd-planner  │
└──────┬───────┘
       │ after_complete
       ├──→ self-improving-agent (background)
       │         └──→ create-pr (ask_first)
       │                  └──→ session-logger (auto)
       └──→ session-logger (auto)
```

## Error Correction Chain

```yaml
on_error:
  triggers:
    - skill: self-improving-agent
      mode: background
      context: "Error occurred in {skill_name}"
    - skill: session-logger
      mode: auto
      context: "Error captured for {skill_name}"
```

## Important Rules

1. **Don't create infinite loops** - Ensure chains terminate
2. **Ask before major actions** - Use `mode: ask_first` for PRs, deployments, and durable file changes
3. **Background tasks** - Use `mode: background` for non-blocking analysis or proposal artifacts
4. **Pass context** - Always include relevant context to triggered skills
