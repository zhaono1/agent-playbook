# Create PR

A skill for creating pull requests with bilingual documentation checks.

## Overview

This skill streamlines the PR creation process for the agent-playbook repository. It ensures that both English and Chinese documentation remain synchronized whenever code changes are submitted.

## Features

- **Change Analysis**: Examines git diff to understand what changed
- **Documentation Sync**: Updates both README.md and README.zh-CN.md when user-facing docs are affected
- **Bilingual Support**: Maintains parity between English and Chinese docs
- **PR Template**: Provides consistent PR description format
- **Verification Checklist**: Ensures nothing is missed before submission

## Installation

```bash
apb skills add ./skills/create-pr --scope global --target all --link
```

## Workflow

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Analyze       │ -> │   Determine     │ -> │   Update Docs   │
│   Changes       │    │   Updates       │    │   (Both EN/CN)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                           │
                                                           v
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Create PR     │ <- │   Commit &      │ <- │   Verify        │
│                 │    │   Push          │    │   Checklist     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Usage

### Basic Usage

```bash
# Simply ask Claude to create a PR
"Please create a PR for my changes"
```

The skill will:
1. Analyze all changes
2. Determine if documentation updates are needed
3. Update both README files
4. Commit and push
5. Create the PR

### With Specific Focus

```bash
"Create a PR for the new skill router"
```

The skill will focus on the skill-router changes and update documentation accordingly.

## Documentation Update Rules

| Change Type | Update Required |
|-------------|-----------------|
| New skill added | ✅ Yes - Add to both READMEs |
| Skill removed | ✅ Yes - Remove from both READMEs |
| Skill description changed | ✅ Yes - Update both READMEs |
 | Bug fix | ❌ No - Unless user-facing |
 | Internal refactor | ❌ No - Documentation unchanged |

## PR Description Template

```markdown
## Summary

<Brief description of the changes>

## Changes

- [ ] New skill added
- [ ] Existing skill modified
- [ ] Documentation updated

## Documentation

- [x] README.md updated
- [x] README.zh-CN.md updated
```

## Bilingual Documentation

### Adding a New Skill

**README.md (English):**
```markdown
| **[skill-name](./skills/skill-name/)** | Skill description |
```

**README.zh-CN.md (Chinese):**
```markdown
| **[skill-name](./skills/skill-name/)** | 技能描述 |
```

### Language Switch Links

Both files must have the switch link at the top:

**README.md:**
```markdown
English | [简体中文](./README.zh-CN.md)
```

**README.zh-CN.md:**
```markdown
[English](./README.md) | 简体中文
```

## Examples

### Example 1: Adding a New Skill

**Input:**
```
"I've created a new skill called skill-router. Please create a PR."
```

**Skill Actions:**
1. Analyzes the skill-router directory
2. Adds skill-router to Meta Skills table in README.md
3. Adds skill-router to 元技能 table in README.zh-CN.md
4. Commits intended changes
5. Pushes to remote branch
6. Creates PR with description

### Example 2: Bug Fix

**Input:**
```
"I fixed a typo in debugger skill. Create a PR."
```

**Skill Actions:**
1. Analyzes the change (typo fix only)
2. Determines no documentation update needed
3. Commits and pushes
4. Creates PR with simple description

## Verification Checklist

Before creating PR, the skill verifies:

- [ ] All changes are committed
- [ ] Branch is pushed to remote
- [ ] Commit messages follow Conventional Commits
- [ ] README.md updated (if needed)
- [ ] README.zh-CN.md updated (if needed)
- [ ] Language switch links present
- [ ] New skills have symlinks created
- [ ] PR title is clear and descriptive

## File Structure

```
skills/create-pr/
├── SKILL.md     # Main skill file
└── README.md    # This file
```

## Contributing

When contributing to this skill:
1. Update both SKILL.md and README.md
2. Test with real PR creation scenarios
3. Ensure bilingual documentation stays in sync

## License

MIT
