# Debugger

> A Claude Code skill for systematic debugging and issue resolution.

## Installation

This skill is part of the [agent-playbook](../../README.md) collection.

## Usage

When encountering an error or bug:

```
You: This function is throwing an error
You: Debug this code
You: Why isn't this working?
```

The skill will:
1. Analyze the error message
2. Trace the root cause
3. Provide debugging steps
4. Suggest fixes

## Debugging Process

| Phase | Description |
|-------|-------------|
| **Understand** | Reproduce and understand the problem |
| **Isolate** | Narrow down the source of the issue |
| **Analyze** | Determine root cause |
| **Fix** | Implement and verify the solution |

## Common Error Types

| Error | Cause | Solution |
|-------|-------|----------|
| TypeError | Wrong type, null reference | Add null check, verify type |
| ReferenceError | Variable not defined | Check imports, scope |
| NetworkError | Connection issues | Check endpoint, CORS |
| TimeoutError | Request too slow | Optimize query, increase timeout |

## Scripts

Generate debug report:
```bash
python scripts/debug_report.py "<error-message>"
```

## Resources

- [Debugging Best Practices](https://google.github.io/eng-practices/debugging/)
- [Systematic Debugging](https://www.amazon.com/Debugging-Software-Technical-Charles-Schooleary/dp/0132519560)
