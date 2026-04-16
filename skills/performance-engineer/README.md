# Performance Engineer

> A Claude Code skill for performance optimization and analysis.

## Installation

This skill is part of the [agent-playbook](../../README.md) collection.

## Usage

```
You: Optimize this code
You: Why is this slow?
You: Profile this application
```

## Performance Targets

| Metric | Target |
|--------|--------|
| API Response (p50) | < 100ms |
| API Response (p95) | < 500ms |
| Database Query | < 50ms |
| Page Load (FMP) | < 2s |
| Time to Interactive | < 3s |

## Scripts

Profile application:
```bash
python scripts/profile.py
```

Generate performance report:
```bash
python scripts/perf_report.py
```

## Resources

- [Web.dev Performance](https://web.dev/performance/)
- [Google Performance](https://developer.chrome.com/docs/lighthouse/performance/)
