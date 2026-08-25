---
name: architecting-solutions
description: Designs technical solutions and architecture. Use when user says "design solution", "architecture design", "technical design", or "方案设计" WITHOUT mentioning PRD. For PRD-specific work, use prd-planner skill instead.
allowed-tools: Read, Write, Edit, Bash, AskUserQuestion, WebSearch, Grep, Glob
metadata:
  hooks:
    after_complete:
      - trigger: self-improving-agent
        mode: background
        reason: "Learn from architecture patterns"
      - trigger: session-logger
        mode: auto
        reason: "Log architecture design"
---

# Architecting Solutions

Analyzes requirements and creates technical solution documents for software implementation.

## Description

Use this skill when you need to:
- Create non-PRD solution briefs or technical design documents
- Design software solutions
- Analyze requirements
- Specify features
- Document technical plans
- Plan refactoring or migration

## Installation

Install through `apb skills add ./skills/architecting-solutions --scope global --target all --link` when possible.

## How It Works

The skill guides Claude through a structured workflow:

1. **Clarify requirements** - Ask targeted questions to understand the problem
2. **Analyze context** - Review existing codebase for patterns and constraints
3. **Design solution** - Propose architecture with trade-offs considered
4. **Generate solution doc** - Output a markdown solution brief or technical design to `{PROJECT_ROOT}/docs/`

**IMPORTANT**: Use `prd-planner` when the user asks for a PRD. This skill writes non-PRD architecture and solution artifacts to the project's `docs/` folder.

## Workflow

Copy this checklist and track progress:

```
Requirements Analysis:
- [ ] Step 1: Clarify user intent and success criteria
- [ ] Step 2: Identify constraints (tech stack, timeline, resources)
- [ ] Step 3: Analyze existing codebase patterns
- [ ] Step 4: Research best practices (if needed)
- [ ] Step 5: Design solution architecture
- [ ] Step 6: Generate solution document (must be in {PROJECT_ROOT}/docs/)
- [ ] Step 7: Validate with user
```

## Step 1: Clarify Requirements

Ask these questions to understand the problem:

### Core Understanding
- **Problem Statement**: What problem are we solving? What is the current pain point?
- **Success Criteria**: How do we know this is successful? Be specific.
- **Target Users**: Who will use this feature? What are their goals?

### For Refactoring/Migration:
- **Why Refactor?**: What's wrong with current implementation? Be specific.
- **Breaking Changes**: What will break? What needs migration?
- **Rollback Plan**: How do we revert if something goes wrong?

## Step 2: Identify Constraints

- **Technical Constraints**: Existing tech stack, architecture patterns, dependencies
- **Time Constraints**: Any deadlines or phases?
- **Resource Constraints**: Team size, expertise availability
- **Business Constraints**: Budget, external dependencies, third-party APIs

## Step 3: Analyze Existing Codebase

```bash
# Find similar patterns in the codebase
grep -r "related_keyword" src/ --include="*.ts" --include="*.tsx"

# Find relevant directory structures
find . -type d -name "*keyword*"

# Check existing patterns
find src -maxdepth 4 -type d -name '*similar*'
```

**Critical for Refactoring:**
- Find ALL consumers of the code being changed
- Identify ALL state/data flows
- Trace ALL entry points and exit points
- **Look for existing mechanisms that might solve the problem already**

```bash
# Find all imports/usages of a module
grep -r "existing-interface" src/ --include="*.ts" --include="*.tsx"
grep -r "related-event" src/ --include="*.ts" --include="*.tsx"
```

**CRITICAL: Before proposing a refactoring, ask:**
1. Is there an **existing mechanism** that can be extended?
2. What's the **simplest possible solution**?
3. Can we solve this with **minimal changes**?
4. **Does my solution actually connect the dots?** (e.g., empty callbacks won't work)

Look for:
- **Architectural patterns**: How are similar features implemented?
- **State management**: What solution and ownership boundaries does this repository already use?
- **Component patterns**: How are components organized?
- **API patterns**: How are API calls structured?
- **Type definitions**: Where are types defined?

## Step 4: Research Best Practices

For unfamiliar domains, search for best practices.

## Step 5: Design Solution Architecture

### CRITICAL: Consider Multiple Solutions

**Before settling on a solution, ALWAYS present multiple options:**

1. **Minimal Change Solution** - What's the absolute smallest change that could work?
2. **Medium Effort Solution** - Balanced approach with some refactoring
3. **Comprehensive Solution** - Full architectural overhaul

**Example:**
```
Problem: Data doesn't refresh after operation

Option 1 (Minimal): Hook into existing pending request count decrease
  - Changes: 1-2 files
  - Risk: Low
  - Selected: ✓

Option 2 (Medium): Add refresh callback through existing shared context
  - Changes: 3-5 files
  - Risk: Medium

Option 3 (Comprehensive): Migrate to a centralized state-store pattern
  - Changes: 10+ files, new atoms/actions
  - Risk: High
  - Time: 2-3 days
```

**Ask user BEFORE writing the solution document:**
- Which option do you prefer?
- Are you open to larger refactoring?
- What's your tolerance for change?

### Architecture Design Principles

1. **Simplicity First**: Choose the simplest solution that meets requirements
2. **Progressive Enhancement**: Start with MVP, extend iteratively
3. **Separation of Concerns**: UI, logic, and data should be separated
4. **Reusability**: Design components that can be reused
5. **Testability**: Design for easy testing

### Document Trade-offs

For each major decision, document:

| Option | Pros | Cons | Selected |
|--------|------|------|----------|
| Approach A | Pro1, Pro2 | Con1 | ✓ |
| Approach B | Pro1 | Con1, Con2 | |

## Step 6: Generate Solution Document

**IMPORTANT**: Always write the solution document to the project's `docs/` directory, never to plan files or hidden locations. Use `prd-planner` instead when the requested artifact is a PRD.

Output location: `{PROJECT_ROOT}/docs/{feature-name}-solution.md`

Example:
- If project root is `/Users/user/my-project/`, write to `/Users/user/my-project/docs/feature-name-solution.md`
- Use kebab-case for filename: `data-refresh-logic-refactoring-solution.md`

## Step 7: Validate with User

Before finalizing:
1. **Review success criteria** - Do they align with user goals?
2. **Check constraints** - Are all constraints addressed?
3. **Verify completeness** - Can another agent implement from this solution document?
4. **Confirm with user** - Get explicit approval before finalizing

---

# Solution Quality Checklist

## Content Quality

- [ ] Problem statement is clear and specific
- [ ] Success criteria are measurable
- [ ] Functional requirements are unambiguous
- [ ] Non-functional requirements are specified
- [ ] Constraints are documented
- [ ] Trade-offs are explained

## Implementation Readiness

- [ ] Architecture is clearly defined
- [ ] File structure is specified
- [ ] API contracts are defined (if applicable)
- [ ] Data models are specified
- [ ] Edge cases are considered
- [ ] Testing approach is outlined

## Agent-Friendliness

- [ ] Another agent can implement without clarification
- [ ] Code examples are provided where helpful
- [ ] File paths use forward slashes
- [ ] Existing code references are accurate

---

## Root Cause Analysis Checklist (CRITICAL)

For bugs, state, refresh, or lifecycle issues, verify:

- [ ] **Existing mechanism** - Does a working solution already exist elsewhere?
- [ ] **Causal gap** - Why does the existing solution not apply here: timing, scope, ownership, or missing wiring?
- [ ] **State ownership** - Which instance or service owns each state transition?
- [ ] **Complete event chain** - Trace trigger → handler → state change → observable effect.
- [ ] **Implemented boundaries** - Confirm each callback, adapter, queue, or registration point performs real work.
- [ ] **Timing semantics** - Identify intervals, retries, focus/lifecycle events, and cancellation behavior.

Common mistakes include assuming separate instances share state, leaving inert
callbacks, checking only the first link in a chain, and confusing an event's
registration with proof that it fired.

---

# Migration Scope Completeness

- [ ] **ALL existing state is accounted for**: List every piece of state being migrated
  - What states are being migrated? (e.g., items, summary, isLoading, filters, pendingRequests)
  - What's the migration strategy for each? (direct move / transform / deprecate)

- [ ] **ALL consumers are identified**: Find every file that uses the code being changed

  ```bash
  rg -n "ModuleName|PublicInterfaceName" .
  ```

- [ ] **Dependency usage points are covered**: Every consumer of the changed interface is identified
  - Primary runtime composition
  - Secondary contexts such as overlays, workers, jobs, or tests when present

## State/Data Flow Validation

- [ ] **No orphaned state**: Every piece of state has a clear source and consumer
- [ ] **No dead state**: Every new state/state variable has a defined purpose and consumer
- [ ] **No undefined references**: All imports/references resolve to existing code
- [ ] **Complete call chain documented**: From trigger → callback → effect, show every step
- [ ] **All related operations covered**: If module has Create/Edit/Delete/Import/Export, test all of them

## Framework Invariants (When Applicable)

- [ ] **Lifecycle rules hold**: Check the actual framework's ordering, registration, and teardown requirements.
- [ ] **Reference semantics hold**: Verify mutable handles, value snapshots, and dependency lifetimes according to the repository's framework.
- [ ] **Conditional behavior is legal**: Do not conditionally register primitives when the framework requires stable ordering.

## Dependency Composition Completeness

- [ ] **Composition owner is defined**: The repository's actual dependency owner is identified
- [ ] **Secondary contexts are covered**: Modals, overlays, workers, tests, or parallel runtimes are checked when relevant
- [ ] **All usage points are wired**: Every consumer receives the required dependency
- [ ] **Runtime registration is proven**: The relevant provider, container, registry, or adapter is present in every required context.

## Framework/System Integration

- [ ] **Registration points**: Required registries, routes, dependency containers, or plugin manifests are updated
- [ ] **Initialization**: Startup and teardown follow the repository's existing lifecycle
- [ ] **No duplicate registrations**: Verify no conflicts with existing entries
- [ ] **Applicability**: Skip framework-specific checks when the repository does not use that mechanism

## Backward Compatibility

- [ ] **Existing consumers work**: Code using the old pattern still works during migration
- [ ] **Migration path is clear**: How do consumers migrate to the new pattern?
- [ ] **Deprecation timeline**: When is the old pattern removed?

## Code Examples

- [ ] **Before/After comparisons**: Show code changes clearly
- [ ] **Type definitions are accurate**: TypeScript types match the implementation
- [ ] **Import paths are correct**: All imports use correct workspace paths

---

# Common Anti-Patterns to Avoid

| Anti-Pattern | Better Approach |
|--------------|-----------------|
| "Optimize the code" | "Reduce render time from 100ms to 16ms by memoizing expensive calculations" |
| "Make it faster" | "Implement caching to reduce API calls from 5 to 1 per session" |
| "Clean up the code" | "Extract duplicate logic into shared utility functions" |
| "Fix the bug" | "Handle null case in getUserById when user doesn't exist" |
| "Refactor the state layer" | "Migrate from Context+Ref to a centralized store: <detailed state list and migration strategy>" |
| **Over-engineering** | **Start with simplest solution, extend only if needed** |

---

# Over-Engineering Warning (Critical Lesson)

## The Problem with Jumping to Complex Solutions

**Illustrative lesson:** A request to refresh after an operation completes may
need only an existing completion signal, not a new shared state subsystem. Trace
the current lifecycle before proposing a broader abstraction.

## Signs You Might Be Over-Engineering

- ❌ Proposing new patterns when existing ones could work
- ❌ Creating new state management before exhausting current options
- ❌ Multiple new files when one file change could suffice
- ❌ "Best practice" justification without considering practicality

## Questions to Ask Before Writing a Solution

1. **Is there an existing mechanism that does 80% of what we need?**
2. **Can we extend/modify existing code instead of creating new patterns?**
3. **What's the absolute minimum change to solve THIS problem?**
4. **Does the user actually want a major refactor?**
5. **Does my solution's callback actually do something?** (Empty callbacks are bugs!)
6. **Have I traced the complete call chain?** (Trigger → ... → Effect)

## When Comprehensive Solutions ARE Appropriate

- Current architecture is fundamentally broken
- Technical debt is blocking all new features
- Team has explicitly decided to modernize
- Problem will recur if not properly addressed

**Key**: Comprehensive solutions should be a CHOICE, not the DEFAULT.

---

# Patterns for Common Scenarios

## New Feature Implementation

```
1. Read similar feature implementations
2. Identify reusable patterns
3. Design component hierarchy
4. Define state management approach
5. Specify API integration points
6. List all new files to create
7. List all existing files to modify
```

## Refactoring Existing Code

```
1. Analyze current implementation
2. Find ALL consumers (grep -r imports)
3. Identify pain points and technical debt
4. PROPOSE MULTIPLE SOLUTIONS (minimal → comprehensive)
5. GET USER APPROVAL on approach
6. Plan migration strategy (phased vs big-bang)
7. Define rollback approach
8. List migration checklist

# CRITICAL: Start with the simplest solution!
# Only propose comprehensive refactoring if user explicitly wants it.
```

## Bug Fix Investigation

```
1. Understand expected vs actual behavior
2. Locate root cause in code
3. Identify affected areas
4. Design fix approach
5. Specify testing for regression prevention
```

---

# Reference Materials

- **Solution Template**: Look at existing architecture or solution docs in the project's `docs/` folder
- **Similar Implementations**: Reference similar features/modules in the codebase

---

# Tips for Effective Solution Documents

1. **Be Specific**: "Improve performance" → "Reduce API response time from 2s to 500ms"
2. **Show Context**: Explain why a decision was made, not just what was decided
3. **Include Examples**: Show code snippets for complex patterns
4. **Think About Edge Cases**: What happens when API fails? User has no data?
5. **Consider Migration**: For refactoring, how do we move from A to B safely?
6. **List ALL Changes**: For refactoring, list every file that changes
7. **Validate Imports**: Verify all import paths exist and are correct
8. **Check Hook Rules**: Ensure no conditional hooks, proper hook dependencies

---

## Accuracy & Completeness (Critical Lessons from Real Solution Reviews)

### Technical Terms - Be Precise

| Wrong | Correct | Why |
|-------|---------|-----|
| "Shared state" | "Each instance polls independently" | Hooks don't share state unless explicitly connected |
| "Pending changes" | "Pending count decreases" | Code checks `!isPending && prevIsPending` (true→false) |
| "Triggers refresh" | "Calls navigation.goBack() which triggers..." | Show the complete chain |

### Call Chain Documentation - Don't Skip Steps

**Bad**: "onRefresh triggers data refresh"
**Good**:
```
onRefresh() → navigation.goBack() → Dashboard focused
  → usePromiseResult (revalidateOnFocus: true) fires
  → refreshItems() → handleRefresh()
  → fetchItems() + refreshSummary() + refreshMetrics()
```

Include file paths and line numbers for each step!

### Test Coverage - Cover ALL Operations

If module has 5 operations (Create/Edit/Delete/Import/Export), test all 5.
Don't just test the 2 you're focused on.

### Timeline Analysis for Refresh/Timing Issues

Draw out the timeline:
```
0s  ---- Modal opens, user starts Edit
10s ---- Action submitted, pending: 0→1
15s ---- Modal closes
        └─ Dashboard hook last polled at 5s
        └─ Next poll at 35s (25s away!) ❌
```

This shows WHY it doesn't work.

### Common Solution Mistakes

| Mistake | Example | Fix |
|---------|---------|-----|
| Empty callback | `onRefresh: () => {}` | Implement actual logic or remove |
| Incomplete root cause | "It doesn't refresh" | Explain WHY: timing/scope/disconnected |
| Missing call chain | "Somehow triggers refresh" | Document every step with file:line |
| Incomplete testing | Only test Create/Edit | Also test Delete/Import/Export |
| Assumptions as facts | "revalidateOnFocus fires on modal close" | Verify: only fires on actual focus change |
| Wrong trigger condition | "Pending changes" | Code shows: `!isPending && prevIsPending` (decreases) |

---
