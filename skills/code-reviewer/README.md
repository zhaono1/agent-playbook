# Code Reviewer

> A Claude Code skill for comprehensive code review of pull requests and code changes.

## Installation

This skill is part of the [agent-playbook](../../README.md) collection.

## Usage

When reviewing code, simply ask:

```
You: Review this PR
You: Check my changes
You: Review the code in src/auth/
```

The skill will:
1. Analyze the changes
2. Check against security best practices
3. Evaluate code quality
4. Review test coverage
5. Provide structured feedback

## Review Categories

| Category | Description |
|----------|-------------|
| **Correctness** | Logic, edge cases, error handling |
| **Security** | OWASP Top 10, secrets, injection prevention |
| **Performance** | N+1 queries, caching, algorithms |
| **Code Quality** | DRY, KISS, naming, abstractions |
| **Testing** | Coverage, edge cases, meaningful assertions |
| **Documentation** | Comments, API docs, README |
| **Maintainability** | Modularity, separation of concerns |

## Output Format

Reviews are structured with severity levels:

- **Critical**: Must fix before merge
- **High**: Should fix before merge
- **Medium**: Consider fixing
- **Low**: Nice to have improvements

## Scripts

Generate a review checklist:

```bash
python scripts/review_checklist.py
```

## References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Google Engineering Practices](https://google.github.io/eng-practices/review/)
- [Clean Code](https://www.amazon.com/Clean-Code-Handbook-Software-Craftsmanship/dp/0132350882)
