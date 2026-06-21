---
name: workflow-orchestrator
description: Coordinates multi-skill workflows and records or runs follow-up actions when the host runtime supports them. Use when completing PRD creation, implementation, or any milestone that should be evaluated for additional skills.
allowed-tools: Read, Write, Edit, Bash, Grep, AskUserQuestion
metadata:
  hooks:
    after_complete:
      - trigger: session-logger
        mode: auto
        reason: "Save workflow execution context"
---

# Workflow Orchestrator

A skill that coordinates workflows across multiple skills by evaluating hook
metadata, recording pending follow-ups, and running only the actions that are
safe and supported in the current host runtime.

## When This Skill Activates

This skill should be used when:
- A skill completes its main workflow
- A milestone is reached (PRD complete, implementation done, etc.)
- User says "complete workflow" or "finish the process"

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                    Workflow Orchestration                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Detect Milestone → 2. Read Hooks → 3. Record/Run Safe Follow-ups │
│                                                             │
│  prd-planner complete                                       │
│       ↓                                                     │
│  workflow-orchestrator                                      │
│       ↓                                                     │
│  ┌─────────────────────────────────────┐                   │
│  │ auto-trigger self-improving-agent   │ (background)       │
│  │ auto-trigger session-logger         │ (auto)            │
│  └─────────────────────────────────────┘                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Trigger Configuration

Read trigger definitions from `skills/auto-trigger/SKILL.md`:

```yaml
hooks:
  after_complete:
    - trigger: self-improving-agent
      mode: background
    - trigger: session-logger
      mode: auto
  on_error:
    - trigger: self-improving-agent
      mode: background
```

## Execution Modes

| Mode | Behavior | Use When |
|------|----------|----------|
| `auto` | Run or record a low-risk follow-up when the host supports it | Logging, status updates |
| `background` | Record a non-blocking follow-up | Reflection, analysis |
| `ask_first` | Ask user before executing | PRs, deployments, major changes |

## Milestone Detection

### PRD Complete

```markdown
Detected when:
- docs/{scope}-prd.md exists
- All phases in {scope}-prd-task-plan.md are checked
- Status shows "COMPLETE"

Actions:
1. Record self-improving-agent as a background follow-up
2. Run or record session-logger if the host supports it
```

### Implementation Complete

```markdown
Detected when:
- All PRD requirements implemented
- Tests pass
- Code committed

Actions:
1. Ask before running code-reviewer
2. Run create-pr only when the user requested submission
3. Run or record session-logger if the host supports it
```

### Self-Improvement Complete

```markdown
Detected when:
- Reflection complete
- Patterns abstracted
- Skill files modified

Actions:
1. Ask before running create-pr
2. Run or record session-logger if the host supports it
```

### Learning Candidate (Skill Complete)

```markdown
Detected when:
- A skill completes its workflow and produces reusable evidence
- User provides feedback
- Error or issue encountered

Actions:
1. Record self-improving-agent as a background follow-up
2. Run or record session-logger if the host supports it

The self-improving-agent:
- Extracts experience from completed skill
- Identifies patterns and insights
- Writes memory or proposal artifacts
- Promotes validated changes only after explicit approval or strong evidence
- Consolidates memory for future reference
```

## Error Handling (on_error)

Detected when:
- A command returns non-zero exit code
- Tests fail after following skill guidance
- User reports the guidance produced incorrect results

Actions:
1. Record self-improving-agent (background) for self-correction
2. Run or record session-logger to capture error context

## Hook Implementation in Skills

To declare follow-up metadata, add this section to any skill's SKILL.md:

```markdown
## Auto-Trigger (After Completion)

When this skill completes, record or run supported follow-ups:

```yaml
hooks:
  after_complete:
    - trigger: skill-name
      mode: auto|background|ask_first
      context: "relevant context"
  on_error:
    - trigger: self-improving-agent
      mode: background
```

### Current Skill Hooks

- **prd-planner**: After PRD complete → self-improving-agent + session-logger
- **self-improving-agent**: After improvement → create-pr + session-logger
- **prd-implementation-precheck**: After implementation → self-improving-agent + session-logger
- **code-reviewer**: After review → self-improving-agent + session-logger
- **debugger**: After debugging → self-improving-agent + session-logger
- **create-pr**: After PR created → session-logger
- **session-logger**: No trigger (terminates chain)

### Universal Learning Pattern

```
┌─────────────────────────────────────────────────────────────┐
│                  Skill Completes With Evidence              │
└──────────────┬──────────────────────────────────────────────┘
               │
               ↓
    ┌──────────────────────┐
    │ workflow-orchestrator │
    └──────────┬───────────┘
               │
    ┌──────────┴─────────┐
    ↓                   ↓
self-improving-agent  session-logger
    ↓                   ↓
Capture proposal      Save context
    ↓                   ↓
Validate changes      Log session
    ↓
create-pr (if modified)
```
```

## Workflow Examples

### Example 1: PRD Creation Workflow

```
User: "Create a PRD for user authentication"
        ↓
prd-planner executes
        ↓
Phase 6 complete: PRD delivered
        ↓
workflow-orchestrator detects milestone
        ↓
┌─────────────────────────────────┐
│ Background: self-improving-agent │ → Records learning proposal
│ Auto: session-logger             │ → Saves session when supported
└─────────────────────────────────┘
```

### Example 2: Full Feature Workflow

```
User: "Create a PRD and implement it"
        ↓
prd-planner → workflow-orchestrator
        ↓
self-improving-agent → workflow-orchestrator
        ↓
prd-implementation-precheck
        ↓
implementation complete → workflow-orchestrator
        ↓
code-reviewer → self-improving-agent → workflow-orchestrator
        ↓
create-pr → workflow-orchestrator
        ↓
session-logger
```

Each milestone can produce a `self-improving-agent` follow-up, but durable
skill edits still require validation or explicit approval.

## Implementation Steps

### Step 1: Detect Milestone

Check for completion indicators:

```bash
# PRD complete?
grep -q "COMPLETE" docs/{scope}-prd-task-plan.md

# All phases checked?
grep -q "^\- \[x\].*Phase 6" docs/{scope}-prd-task-plan.md

# PRD file exists?
ls docs/{scope}-prd.md
```

### Step 2: Read Trigger Config

```bash
# Read hooks from auto-trigger skill
cat skills/auto-trigger/SKILL.md
```

### Step 3: Record or Execute Hooks

For each hook in order (before_start, after_complete, on_error):
1. Check if condition is met
2. Record or execute based on mode and host support
3. Pass context to triggered skill
4. Wait/continue based on mode

### Step 4: Update Status

Log what was triggered and the result:

```markdown
## Workflow Execution

- [x] self-improving-agent (background) - Started
- [x] session-logger (auto) - Session saved
- [ ] create-pr (ask_first) - Pending user approval
```

## Skills with Auto-Trigger

| Skill | Triggers After |
|-------|----------------|
| `prd-planner` | self-improving-agent, session-logger |
| `self-improving-agent` | create-pr, session-logger |
| `prd-implementation-precheck` | self-improving-agent, session-logger |
| `code-reviewer` | self-improving-agent, session-logger |
| `create-pr` | session-logger |
| `refactoring-specialist` | self-improving-agent, session-logger |
| `debugger` | self-improving-agent, session-logger |

## Adding Follow-up Metadata to Existing Skills

To add follow-up metadata to an existing skill, add to the end of its SKILL.md:

```markdown
---

## Auto-Trigger

When this skill completes, record or run supported follow-ups:

```yaml
hooks:
  after_complete:
    - trigger: session-logger
      mode: auto
      context: "Save session context"
```
```

For more complex triggers, specify mode and context:

```markdown
## Auto-Trigger

When this skill completes:

```yaml
hooks:
  after_complete:
    - trigger: next-skill
      mode: background
      context: "Description"
    - trigger: session-logger
      mode: auto
      context: "Save session"
    - trigger: create-pr
      mode: ask_first
      context: "Create PR if files modified"
  on_error:
    - trigger: self-improving-agent
      mode: background
```
```

## Best Practices

1. **Always log to session** - Every workflow should end with session-logger
2. **Ask before major actions** - PRs, deployments, destructive changes
3. **Background for analysis** - Reflection, evaluation, optimization
4. **Auto for status** - Logging, status updates, bookmarks
5. **Don't create loops** - Ensure chains terminate
