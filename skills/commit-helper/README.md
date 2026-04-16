# Commit Helper

> A Claude Code skill for writing Git commit messages following the Conventional Commits specification.

## Installation

This skill is part of the [agent-playbook](../../README.md) collection.

## Usage

When working with Git, simply ask Claude to commit your changes:

```
You: commit my changes
```

The skill will automatically:
1. Review your changes with `git diff`
2. Generate a properly formatted commit message
3. Present it for your approval
4. Execute the commit when confirmed

## Examples

### Simple Feature
```
You: Commit the new user authentication feature

Claude generates:
feat(auth): add OAuth2 login support

Implement OAuth2 authentication flow for Google and GitHub.
Users can now link multiple social accounts to their profile.
```

### Bug Fix
```
You: Commit the API timeout fix

Claude generates:
fix(api): resolve timeout in user endpoint

Added 30-second timeout to database query to prevent slow queries
from causing request timeouts.
```

## Validation

The skill includes a validation script to check commit message format:

```bash
python scripts/validate_commit.py "feat(api): add user endpoint"
```

## References

- [Conventional Commits Specification](https://www.conventionalcommits.org/)
- [Angular Commit Guidelines](https://github.com/angular/angular/blob/master/CONTRIBUTING.md#commit)
