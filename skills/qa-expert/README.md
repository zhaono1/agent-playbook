# QA Expert

> A Claude Code skill for quality assurance strategy and quality gates.

## Installation

This skill is part of the [agent-playbook](../../README.md) collection.

## Usage

```
You: Create a QA plan
You: Set up quality gates
You: What tests should I write?
```

## Quality Gates

| Gate | Purpose |
|------|---------|
| **Lint** | Code style and formatting |
| **Type Check** | Type safety |
| **Unit Tests** | Functionality correctness |
| **Integration Tests** | Component interaction |
| **E2E Tests** | User workflows |

## Scripts

Generate test plan:
```bash
python scripts/generate_test_plan.py <feature>
```

## Resources

- [Google Testing Blog](https://testing.google.com/)
- [Ministry of Testing](https://www.ministryoftesting.com/)
