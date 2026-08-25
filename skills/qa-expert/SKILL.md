---
name: qa-expert
description: Quality assurance expert for testing strategies and quality gates. Use when planning test coverage, setting up QA processes, or improving quality standards.
allowed-tools: Read, Write, Edit, Bash, Grep, Glob, WebFetch, WebSearch
metadata:
  hooks:
    after_complete:
      - trigger: session-logger
        mode: auto
        reason: "Log QA activity"
---

# QA Expert

Quality assurance specialist for developing comprehensive testing strategies and quality gates.

## When This Skill Activates

Activates when you:
- Ask for QA strategy
- Need quality gates
- Want to improve test coverage
- Plan testing approach

## Quality Assurance Strategy

### 1. Risk-Based Testing

Prioritize testing based on business impact, likelihood, change surface, and
existing production evidence. The approaches below are examples to tailor, not
universal requirements:

| Risk Level | Testing Approach |
|------------|------------------|
| **Critical** (Money, Security, Data) | Strong deterministic coverage; add resilience testing when the system supports it |
| **High** (Core features) | Full E2E, integration, unit |
| **Medium** (Secondary features) | Integration, unit |
| **Low** (Edge features) | Unit tests only |

### 2. Testing Portfolio

Choose the mix from system boundaries and failure cost. Do not enforce a fixed
ratio when a repository's architecture or existing test strategy indicates a
different shape.

| Level | Example Starting Mix | Focus |
|-------|------------|-------|
| E2E | 10% | Critical user journeys |
| Integration | 30% | API interactions |
| Unit | 60% | Business logic, utilities |

Treat this table as an illustration only. Derive the actual portfolio from the
repository's architecture, risk profile, SLOs, and existing quality gates.

### 3. Quality Gates

#### Pre-Commit
```bash
- Lint: npm run lint
- Format check: npm run format:check
- Type check: npm run type-check
- Unit tests: npm run test:unit
```

#### Pre-Merge
```bash
- All tests: npm test
- Coverage threshold: use the repository gate or agree a risk-based target
- Security scan: npm audit
- License check: npm run check:licenses
```

#### Pre-Production
```bash
- Full test suite: npm run test:all
- E2E tests: npm run test:e2e
- Performance tests: npm run test:perf
- Security audit: npm audit --audit-level high
```

## Test Categories

### Functional Testing

**Purpose**: Verify features work as specified

- Happy path testing
- Edge case testing
- Boundary value analysis
- Error handling

### Non-Functional Testing

**Performance**
- Derive latency and throughput targets from the current SLO, baseline, workload, and user journey
- Memory usage stable
- No memory leaks

**Security**
- OWASP Top 10 coverage
- Penetration testing
- Dependency vulnerability scan
- Secrets detection

**Compatibility**
- Browser testing (Chrome, Firefox, Safari, Edge)
- Device testing (Mobile, Desktop, Tablet)
- OS testing (Windows, macOS, Linux)
- Version testing (N-1 browser versions)

### Regression Testing

- Previous bugs don't reappear
- New features don't break existing features
- Performance doesn't degrade

### Exploratory Testing

- Find unexpected issues
- Test edge cases
- User experience issues

## Test Planning

### Test Plan Template

```markdown
# Test Plan: [Feature Name]

## Overview
[Feature description]

## Scope
[In scope / Out of scope]

## Test Cases

### Functional
- [ ] TC001: [Description]
- [ ] TC002: [Description]

### Integration
- [ ] TC101: [Description]

### E2E
- [ ] TC201: [Description]

## Test Data
[Required test data]

## Environment
[Test environment setup]

## Schedule
[Testing timeline]

## Exit Criteria
[Definition of done]
```

## Quality Metrics

Use existing project gates first. If none exist, establish a baseline and agree
targets with the owner; the values below are illustrative examples, not default
acceptance criteria.

### Code Quality
- **Test Coverage**: > 80%
- **Cyclomatic Complexity**: < 10 per function
- **Code Duplication**: < 5%
- **Technical Debt Ratio**: < 5%

### Defect Metrics
- **Defect Density**: < 1 defect per 1000 LOC
- **Critical Defects**: 0
- **High Defects**: 0
- **Medium Defects**: < 3

### Test Metrics
- **Test Pass Rate**: > 95%
- **Flaky Tests**: 0
- **Test Execution Time**: < 10 minutes

## Automation Strategy

### Automate When
- Test is run frequently
- Test has deterministic results
- Test is stable
- ROI justifies automation cost

### Don't Automate When
- Test requires human judgment
- Test is exploratory
- Test is one-time only
- Test changes frequently

## Bug Report Template

```markdown
## Bug Summary
[One-line summary]

## Severity
Critical / High / Medium / Low

## Steps to Reproduce
1.
2.
3.

## Expected Behavior
[What should happen]

## Actual Behavior
[What actually happens]

## Environment
- OS:
- Browser:
- Version:

## Attachments
[Screenshots, logs, etc.]
```

## Scripts

Generate test plan:
```bash
python3 scripts/generate_test_plan.py --name <feature> --output docs/test-plan.md
```

Analyze test coverage:
```bash
python3 scripts/coverage_analysis.py --name <service-name> --output coverage-analysis.md
```

## References

- `references/strategy.md` - Testing strategies
- `references/gates.md` - Quality gate definitions
- `references/metrics.md` - QA metrics and KPIs
