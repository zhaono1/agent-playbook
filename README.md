# Agent Playbook

> A collection of practical guides, prompts, and skills for AI Agents (Claude Code)

English | [简体中文](./README.zh-CN.md)

## Overview

This repository collects practical, public-facing building blocks for AI agents: reusable skills, prompt patterns, workflow docs, and tooling for Claude Code, Codex, and Gemini.

Everything in this repository is intended to stay portable and abstract. Private operating details, company-specific workflows, and sensitive business context should live elsewhere.

## What you get

- Reusable skills with focused `SKILL.md` files and deeper `references/` material
- Installation and lifecycle tooling through `@codeharbor/agent-playbook`
- An MCP server for skill discovery
- Workflow docs for planning, self-improvement, automation, and context design

## Design Principles

The repository is evolving around a few portable agent design rules:

- Keep hard constraints always-on, but keep them short
- Turn reusable methods into skills
- Keep detailed facts and examples retrievable from references and docs
- Persist long-running task state outside chat so recovery is reliable

Further reading:

- [Context Layering for Agent Playbooks](./docs/context-layering-for-agent-playbooks.md)
- [long-task-coordinator](./skills/long-task-coordinator/)

## Who this is for

- Builders creating their own reusable agent skills
- Teams standardizing how agents plan, review, and recover work
- Power users who want local-first tooling instead of SaaS-heavy orchestration

## Installation

### Method 0: One-Command Installer (PNPM/NPM)

Sets up skills for Claude Code, Codex, and Gemini. It currently wires session logging and self-improvement hooks for Claude Code, records an `agent_playbook` metadata block for Codex, and prepares Gemini skill directories.

```bash
pnpm dlx @codeharbor/agent-playbook init
# or
npm exec -- @codeharbor/agent-playbook init
```

Project-only setup:

```bash
pnpm dlx @codeharbor/agent-playbook init --project
```

### Method 1: Symbolic Links (Recommended)

Link the skills to your global skills directories:

```bash
# Create symbolic links for each skill
ln -s /path/to/agent-playbook/skills/* ~/.claude/skills/
ln -s /path/to/agent-playbook/skills/* ~/.codex/skills/
ln -s /path/to/agent-playbook/skills/* ~/.gemini/skills/
```

Example:

```bash
# Link individual skills
ln -s ~/Documents/code/GitHub/agent-playbook/skills/skill-router ~/.claude/skills/skill-router
ln -s ~/Documents/code/GitHub/agent-playbook/skills/architecting-solutions ~/.claude/skills/architecting-solutions
ln -s ~/Documents/code/GitHub/agent-playbook/skills/planning-with-files ~/.claude/skills/planning-with-files
```

### Method 2: Copy Skills

Copy the skills directly to your global skills directories:

```bash
cp -r /path/to/agent-playbook/skills/* ~/.claude/skills/
cp -r /path/to/agent-playbook/skills/* ~/.codex/skills/
cp -r /path/to/agent-playbook/skills/* ~/.gemini/skills/
```

### Method 3: Add to Project-Specific Skills

For project-specific usage, create `.claude/.codex/.gemini` skills directories in your project:

```bash
mkdir -p .claude/skills .codex/skills .gemini/skills
cp -r /path/to/agent-playbook/skills/* .claude/skills/
cp -r /path/to/agent-playbook/skills/* .codex/skills/
cp -r /path/to/agent-playbook/skills/* .gemini/skills/
```

### Verify Installation

List your installed skills:

```bash
ls -la ~/.claude/skills/
ls -la ~/.codex/skills/
ls -la ~/.gemini/skills/
```

## Skills Manager

Use the local-only skills manager to inspect and manage skills across project and global scopes:

```bash
apb skills list --scope both --target all
apb skills add ./skills/my-skill --scope project --target claude
```

`apb` is a short alias for `agent-playbook`.

## Platform support

| Platform | Skill install | Hooks/config automation | Current status |
|----------|---------------|-------------------------|----------------|
| Claude Code | Yes | Installs SessionEnd and PostToolUse hooks | Full |
| Codex | Yes | Writes `agent_playbook` metadata block to `~/.codex/config.toml` | Partial |
| Gemini | Yes | No hook wiring yet | Skill distribution only |

The MCP server is a separate optional integration and is currently documented for Claude Code.

## Project Structure

```text
agent-playbook/
├── prompts/       # Prompt templates and examples
├── skills/        # Custom skills documentation
├── docs/          # Automation best practices and examples
├── mcp-server/    # MCP server for skill discovery
└── README.md      # Project documentation
```

## Skills Catalog

### Meta Skills (Workflow & Automation)

| Skill | Description | Auto-Trigger |
|-------|-------------|--------------|
| **[skill-router](./skills/skill-router/)** | Intelligently routes user requests to the most appropriate skill | Manual |
| **[create-pr](./skills/create-pr/)** | Creates PRs with automatic bilingual documentation updates | After skill updates |
| **[session-logger](./skills/session-logger/)** | Saves conversation history to session log files | Auto (after any skill) |
| **[auto-trigger](./skills/auto-trigger/)** | Defines automatic trigger relationships between skills | Config only |
| **[workflow-orchestrator](./skills/workflow-orchestrator/)** | Coordinates multi-skill workflows and triggers follow-up actions | Auto |
| **[self-improving-agent](./skills/self-improving-agent/)** | Universal self-improvement that learns from ALL skill experiences | Background |

### Core Development

| Skill | Description | Auto-Trigger |
|-------|-------------|--------------|
| **[commit-helper](./skills/commit-helper/)** | Git commit messages following Conventional Commits specification | Manual |
| **[code-reviewer](./skills/code-reviewer/)** | Comprehensive code review for quality, security, and best practices | Manual / After implementation |
| **[debugger](./skills/debugger/)** | Systematic debugging and issue resolution | Manual |
| **[refactoring-specialist](./skills/refactoring-specialist/)** | Code refactoring and technical debt reduction | Manual |

### Documentation & Testing

| Skill | Description | Auto-Trigger |
|-------|-------------|--------------|
| **[documentation-engineer](./skills/documentation-engineer/)** | Technical documentation and README creation | Manual |
| **[api-documenter](./skills/api-documenter/)** | OpenAPI/Swagger API documentation | Manual |
| **[test-automator](./skills/test-automator/)** | Automated testing framework setup and test creation | Manual |
| **[qa-expert](./skills/qa-expert/)** | Quality assurance strategy and quality gates | Manual |

### Architecture & DevOps

| Skill | Description | Auto-Trigger |
|-------|-------------|--------------|
| **[api-designer](./skills/api-designer/)** | REST and GraphQL API architecture design | Manual |
| **[security-auditor](./skills/security-auditor/)** | Security audit covering OWASP Top 10 | Manual |
| **[performance-engineer](./skills/performance-engineer/)** | Performance optimization and analysis | Manual |
| **[deployment-engineer](./skills/deployment-engineer/)** | CI/CD pipelines and deployment automation | Manual |

### Planning & Architecture

| Skill | Description | Auto-Trigger |
|-------|-------------|--------------|
| **[prd-planner](./skills/prd-planner/)** | Creates PRDs using persistent file-based planning | Manual (keyword: "PRD") |
| **[prd-implementation-precheck](./skills/prd-implementation-precheck/)** | Performs preflight review before implementing PRDs | Manual |
| **[architecting-solutions](./skills/architecting-solutions/)** | Technical solution and architecture design | Manual (keyword: "design solution") |
| **[planning-with-files](./skills/planning-with-files/)** | General file-based planning for multi-step tasks | Manual |
| **[long-task-coordinator](./skills/long-task-coordinator/)** | Coordinates multi-session or delegated work with persistent state and recovery rules | Manual |

### Design & Creative

| Skill | Description | Auto-Trigger |
|-------|-------------|--------------|
| **[figma-designer](./skills/figma-designer/)** | Analyzes Figma designs and generates implementation-ready PRDs with visual specifications | Manual (Figma URL) |

## How Auto-Triggers Work

Skills can automatically trigger other skills when they complete. This creates workflows:

```
┌──────────────┐
│  prd-planner │ completes
└──────┬───────┘
       │
       ├──→ self-improving-agent (background) → learns from PRD patterns
       │         └──→ create-pr (ask first) ──→ session-logger (auto)
       │
       └──→ session-logger (auto)
```

### Auto-Trigger Modes

| Mode | Behavior |
|------|----------|
| `auto` | Executes immediately, blocks until complete |
| `background` | Runs without blocking, no wait for result |
| `ask_first` | Asks user before executing |

## Usage

Once installed, skills are automatically available in any Claude Code session. You can invoke them by:

1. **Direct activation** - The skill activates based on context (e.g., mentioning "PRD", "planning")
2. **Manual invocation** - Explicitly ask Claude to use a specific skill

Example:

```
You: Create a PRD for a new authentication feature
```

The `prd-planner` skill will activate automatically.

## Workflow Example

Full PRD-to-implementation workflow:

```
User: "Create a PRD for user authentication"
       ↓
prd-planner executes
       ↓
Phase complete → Auto-triggers:
       ├──→ self-improving-agent (background) - extracts patterns
       └──→ session-logger (auto) - saves session
       ↓
User: "Implement this PRD"
       ↓
prd-implementation-precheck → implementation
       ↓
code-reviewer → self-improving-agent → create-pr
```

## AI Agent Learning Path

**[docs/ai-agent-learning-path.md](./docs/ai-agent-learning-path.md)** - A progressive learning path for building agents with Claude, GLM, and Codex:

| Level | Topic | Time | Outcome |
|-------|------|------|------|
| 1 | Prompt engineering fundamentals | 1 week | Complete a single-task workflow |
| 2 | Skill development | 1 week | Ship a first reusable skill |
| 3 | Workflow orchestration | 2 weeks | Build a complete automated workflow |
| 4 | Self-learning systems | 2-3 weeks | Create an agent that learns from experience |
| 5 | Self-evolving agents | 2-3 weeks | Build a more autonomous improvement loop |

## Complete Workflow Example

**[docs/complete-workflow-example.md](./docs/complete-workflow-example.md)** - An end-to-end example from input or design reference to final delivery:

1. **Input** → Upload an image or describe the request
2. **PRD** → `prd-planner` creates the PRD and can trigger `self-improving-agent`
3. **Review** → Review and refine the plan
4. **Implement** → Build against the PRD
5. **Review** → `code-reviewer` checks quality
6. **Feedback** → `self-improving-agent` learns from the result
7. **Submit** → `create-pr` opens a PR and keeps bilingual docs aligned

## Updating Skills

When you update skills in agent-playbook, the symbolic links ensure you always have the latest version. To update:

```bash
cd /path/to/agent-playbook
git pull origin main
```

If using copied skills, re-copy the updated files:

```bash
cp -r /path/to/agent-playbook/skills/* ~/.claude/skills/
```

## Contributing

Contributions are welcome! Feel free to submit PRs with your own prompts, skills, or use cases.

When contributing skills:

1. Add your skill to the appropriate category in the Skills Catalog above
2. Include `SKILL.md` with proper front matter (name, description, allowed-tools, hooks)
3. Add `README.md` with usage examples
4. Keep `SKILL.md` lean and move long procedures or templates into `references/`
5. Prefer abstract, portable guidance over private or business-specific knowledge
6. Add explicit acceptance criteria so the skill has a clear definition of done
7. Add lightweight eval prompts or scenario checks for new skills when practical
8. Follow the structure and guidance from [Anthropic's skill-creator](https://github.com/anthropics/skills/tree/main/skills/skill-creator)
9. Update both README.md and README.zh-CN.md when bilingual parity is part of the change
10. Validate skill structure: `python3 scripts/validate_skills.py`
11. Optional: run skills-ref validation: `python3 -m pip install "git+https://github.com/agentskills/agentskills.git@main#subdirectory=skills-ref" && skills-ref validate skills/<name>`

## License

MIT License
