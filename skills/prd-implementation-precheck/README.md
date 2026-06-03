# PRD Implementation Precheck

A skill that performs mandatory preflight review before implementing PRDs, ensuring issues are caught before coding begins.

## Overview

Instead of blindly implementing a PRD, this skill:
1. Reviews the PRD for scope, alignment, dependencies, and risks
2. Presents findings and questions to the user
3. Waits for confirmation before proceeding
4. Implements with minimal, consistent changes

## Installation

```bash
mkdir -p ~/.claude/skills
ln -s ~/Documents/code/GitHub/agent-playbook/skills/prd-implementation-precheck ~/.claude/skills/prd-implementation-precheck
```

## Usage

```bash
# Ask to implement a PRD
"Implement the PRD at docs/feature-prd.md"

# The skill will:
# 1. Read and analyze the PRD
# 2. Present precheck report with questions
# 3. Wait for your confirmation
# 4. Implement after approval
```

## Precheck Checklist

| Category | What's Checked |
|----------|---------------|
| **Scope** | Over-broad changes? Suggest targeted approach |
| **Alignment** | Conflicts with existing patterns? Propose alternatives |
| **Dependencies** | Missing hooks/providers/data sources? |
| **Behavior** | Flows and edge cases specified? |
| **Risks** | Performance, regression, migration issues? |
| **Testing** | Success criteria and test coverage clear? |

## Workflow

```
┌─────────────────────────────────────────────────────────────┐
│                    PRD Implementation                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Locate PRD → Read all referenced files                  │
│  2. Precheck → Run checklist, identify issues              │
│  3. Present → Show findings, ask questions                  │
│  4. Confirm → User approves or updates PRD                  │
│  5. Implement → Minimal, consistent changes                 │
│  6. Validate → Tests or manual verification                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Output Example

```markdown
## Precheck Report for {PRD}

### Intent
{1-2 sentence summary}

### Blockers
- [ ] Blocker 1
- [ ] Blocker 2

### Questions
1. Question about scope?
2. Question about dependencies?

### Risks
- Risk 1
- Risk 2

### Recommendation
Proceed as-is, or update the PRD first?
```

## Benefits

| Problem | Solution |
|---------|----------|
| Implementing unclear PRDs | Precheck catches gaps |
| Scope creep | Identified early |
| Breaking existing patterns | Flagged before coding |
| Missing dependencies | Found before implementation |
| Unclear success criteria | Clarified upfront |

## License

MIT
