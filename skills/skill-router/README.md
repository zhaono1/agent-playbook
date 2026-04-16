# Skill Router

An intelligent routing layer for Claude Code skills that helps users find the right skill for their task.

## Overview

The Skill Router analyzes user requests and intelligently recommends the most appropriate skill from the available catalog. It uses intent classification, semantic matching, and interactive clarification to ensure users get the help they need.

## Installation

```bash
# Create symbolic link to global skills directory
ln -s ~/Documents/code/GitHub/agent-playbook/skills/skill-router/SKILL.md ~/.claude/skills/skill-router.md
```

## How It Works

```
User Request → Intent Analysis → Skill Matching → Recommendation
                                    ↓
                         Interactive Clarification (if needed)
```

### Routing Process

1. **Intent Analysis**: Parse user request to identify task type, context, and complexity
2. **Skill Matching**: Match intent against available skills using keywords and semantics
3. **Interactive Clarification**: Ask targeted questions if request is ambiguous
4. **Recommendation**: Present the best matching skill with reasoning

## Usage Examples

### Direct Skill Match

```
You: "I need to review this pull request"

Skill Router: Recommended Skill: code-reviewer
This skill is designed for reviewing PRs and code changes for quality,
security, and best practices.

Would you like me to activate this skill?
```

### Ambiguous Request

```
You: "Use a skill to help with my project"

Skill Router: I'd like to understand your needs better:
- What type of task are you working on?
- Are you designing, coding, testing, or documenting?
- What's the primary goal?

[Based on your answers, I'll recommend the right skill]
```

### Multi-Skill Workflow

```
You: "I'm building a new API from scratch"

Skill Router: For a complete API project, I recommend using multiple skills:

1. api-designer - Design your API structure and endpoints
2. api-documenter - Create OpenAPI/Swagger documentation
3. test-automator - Set up automated API testing
4. code-reviewer - Review your implementation

Shall we start with api-designer?
```

## Supported Skills

| Category | Skills |
|----------|--------|
| **Core Development** | commit-helper, code-reviewer, debugger, refactoring-specialist |
| **Documentation & Testing** | documentation-engineer, api-documenter, test-automator, qa-expert |
| **Architecture & DevOps** | api-designer, security-auditor, performance-engineer, deployment-engineer |
| **Planning & Analysis** | architecting-solutions, planning-with-files, long-task-coordinator, self-improving-agent |

## Features

- **Intent Classification**: Understands what the user wants to accomplish
- **Semantic Matching**: Finds relevant skills even with different wording
- **Interactive Guidance**: Asks clarifying questions when needed
- **Multi-Skill Orchestrations**: Suggests skill combinations for complex tasks
- **Confidence Indicators**: Shows how confident the recommendation is

## Best Practices

### For Users

1. **Be specific**: "I need to write tests for my API" vs "Help with tests"
2. **Provide context**: Mention your project type and stage
3. **Answer clarification questions**: Helps the router find the best match
4. **Request alternatives**: Ask "What are my options?" for multiple choices

### For Maintainers

1. **Update skill catalog**: Add new skills to the catalog table
2. **Refine routing logic**: Add new patterns and keywords
3. **Track edge cases**: Note requests that don't fit existing skills
4. **Improve questions**: Refine clarification templates based on usage

## Routing Patterns

| User Says | Routes To |
|-----------|-----------|
| "review my code" | code-reviewer |
| "fix this bug" | debugger |
| "write tests" | test-automator |
| "create documentation" | documentation-engineer |
| "design an API" | api-designer |
| "deploy to production" | deployment-engineer |
| "improve performance" | performance-engineer |
| "check security" | security-auditor |
| "refactor code" | refactoring-specialist |
| "resume this long task" | long-task-coordinator |
| "commit these changes" | commit-helper |

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Skill Router                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ Intent       │  │ Skill        │  │ Interactive  │ │
│  │ Analyzer     │→ │ Matcher      │→ │ Clarifier    │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
│                          ↓                              │
│                   ┌──────────────┐                      │
│                   │ Recommended  │                      │
│                   │ Skill        │                      │
│                   └──────────────┘                      │
└─────────────────────────────────────────────────────────┘
                           │
                           ↓
        ┌──────────────────┼──────────────────┐
        │                  │                  │
    ┌───▼────┐      ┌─────▼────┐     ┌──────▼───┐
    │ Skill 1│      │  Skill 2 │     │  Skill N │
    └────────┘      └──────────┘     └──────────┘
```

## References

- [AI Agent Routing: Tutorial & Best Practices](https://www.patronus.ai/ai-agent-development/ai-agent-routing)
- [Intent Recognition in Multi-Agent Systems](https://gist.github.com/mkbctrl/a35764e99fe0c8e8c00b2358f55cd7fa)
- [Multi-LLM Routing Strategies - AWS](https://aws.amazon.com/blogs/machine-learning/multi-llm-routing-strategies-for-generative-ai-applications-on-aws/)

## License

MIT
