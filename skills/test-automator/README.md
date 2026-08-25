# Test Automator

> A portable agent skill for creating and maintaining automated tests.

## Installation

This skill is part of the [agent-playbook](../../README.md) collection.

## Usage

```
You: Write tests for this function
You: Create test cases
You: Improve test coverage
```

## Testing Frameworks

| Language | Framework |
|----------|-----------|
| TypeScript/JS | Jest, Vitest, Mocha |
| Python | pytest, unittest |
| Go | testing package |
| Java | JUnit |

## Scripts

Generate test boilerplate:
```bash
python3 scripts/generate_test.py --name <feature> --output tests/test-plan.md
```

Check test coverage:
```bash
python3 scripts/coverage_report.py --name <service-name> --output coverage-report.md
```

## Resources

- [Testing Best Practices](https://google.github.io/eng-practices/review/developer/tests.html)
- [Test Driven Development](https://www.amazon.com/Test-Driven-Development-Kent-Beck/dp/0321146530)
