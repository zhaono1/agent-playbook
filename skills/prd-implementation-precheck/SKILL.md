---
name: prd-implementation-precheck
description: Precheck a PRD or feature specification before implementation, resolving material blockers while continuing directly when requirements are clear.
allowed-tools: Read, Write, Edit, Bash, Grep, Glob, AskUserQuestion
metadata:
  hooks:
    after_complete:
      - trigger: self-improving-agent
        mode: background
        reason: "Learn from implementation patterns"
      - trigger: session-logger
        mode: auto
        reason: "Log PRD implementation activity"
---

# PRD Implementation Precheck

## Overview

Perform a short PRD precheck, surface material issues, then implement. Ask the
user only when a missing choice would materially change behavior, architecture,
data, or external side effects.

## Workflow

1. Locate the PRD and any referenced files.
2. Precheck the PRD and summarize intent in 1-2 sentences.
3. List findings and questions with blockers first. If there are no material blockers, state assumptions and continue.
4. When a blocker exists, resolve it with the user before implementation.
5. Validate (tests or manual steps) or state what was not run.

## Precheck Checklist

### Basic Checks

- **Scope**: Identify over-broad changes; suggest a smaller, targeted approach.
- **Alignment**: Flag conflicts with existing patterns or architecture; propose alternatives.
- **Dependencies**: Note missing hooks/providers/data sources or unclear ownership.
- **Behavior**: Verify flows and edge cases are specified; ask for gaps.
- **Risks**: Call out performance, regressions, or migration risks.
- **Testing**: Check success criteria and test coverage; request specifics if vague.

### Edge Case Coverage Checks

Verify the PRD addresses these edge cases (mark as ⚠️ if missing):

#### Data Boundaries
- [ ] **Null/Empty handling** - What happens with empty inputs or null values?
- [ ] **Boundary values** - Are min/max limits defined? What happens at boundaries?
- [ ] **Duplicate data** - How are duplicates detected and handled?
- [ ] **Data format** - Are input formats validated? What about special characters?

#### State Boundaries
- [ ] **State transitions** - Are all valid state transitions defined?
- [ ] **Invalid transitions** - What happens on illegal state changes?
- [ ] **Concurrent modifications** - How are simultaneous edits handled?
- [ ] **Rollback scenarios** - Can operations be undone? How?

#### Error Boundaries
- [ ] **Network failures** - What happens when API calls fail?
- [ ] **Timeout behavior** - Are timeouts defined? What's the retry strategy?
- [ ] **Partial failures** - If step 2 of 3 fails, what happens to step 1?
- [ ] **Error messages** - Are user-facing error messages defined?

#### UX Boundaries
- [ ] **Empty states** - What does the user see with no data?
- [ ] **Loading states** - How is loading indicated?
- [ ] **Success feedback** - How does the user know the action succeeded?
- [ ] **Permission denied** - What happens when user lacks permission?

### Codebase Consistency Checks

Scan the codebase to verify PRD aligns with existing patterns:

```bash
# Check if PRD's proposed patterns match existing code
grep -r "pattern_from_prd" src/ --include="*.ts"
```

- [ ] **Delete strategy** - Does PRD match existing soft/hard delete pattern?
- [ ] **Error handling** - Does PRD use the same error display mechanism?
- [ ] **Component reuse** - Does PRD leverage existing components?
- [ ] **API patterns** - Does PRD follow existing API conventions?

## Output Format

### Precheck Report Template

```markdown
## PRD Precheck Report

### Summary
{1-2 sentence summary of what the PRD aims to achieve}

### ✅ Covered Edge Cases
- {List edge cases that are well-defined in the PRD}

### ⚠️ Missing Edge Cases
| Edge Case | Category | Suggested Default | Needs Confirmation |
|-----------|----------|-------------------|-------------------|
| Empty list display | UX | Use existing EmptyState | No |
| Concurrent edit | State | Last write wins | **Yes** |

### 🔴 Blockers
- {Critical issues that must be resolved before implementation}

### 🟡 Warnings
- {Non-critical issues that should be addressed}

### Questions for User
1. {Specific question about missing edge case}
2. {Specific question about ambiguous requirement}

---

**Proceed as-is, or update the PRD?**
```

## Output Expectations

- Provide a concise precheck report with questions and risks.
- Ask "Proceed as-is, or update the PRD?" only when the answer changes the implementation materially.
- If there are no blockers, state assumptions and continue without a redundant confirmation round.
