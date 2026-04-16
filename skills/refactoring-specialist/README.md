# Refactoring Specialist

> A Claude Code skill for code refactoring and technical debt reduction.

## Installation

This skill is part of the [agent-playbook](../../README.md) collection.

## Usage

```
You: Refactor this code
You: Clean up this function
You: This code is messy, help me improve it
```

## Common Refactorings

| Code Smell | Refactoring |
|------------|-------------|
| Long Method | Extract Method |
| Duplicate Code | Extract Method |
| Large Class | Extract Class |
| Long Parameter List | Introduce Parameter Object |
| Switch Statement | Replace with Polymorphism |

## Principles

1. **Behavior Preservation**: Refactoring must not change external behavior
2. **Small Steps**: Make incremental changes
3. **Test Coverage**: Ensure tests pass before and after
4. **Commit Often**: Commit after each successful refactoring

## Resources

- [Refactoring.com](https://refactoring.com/)
- [Clean Code](https://www.amazon.com/Clean-Code-Handbook-Software-Craftsmanship/dp/0132350882)
