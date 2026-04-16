# Agent Playbook

> A collection of practical guides, prompts, and skills for AI Agents (Claude Code)

English | [简体中文](./README.zh-CN.md)

## Overview

This repository organizes and stores practical resources for working with AI Agents like Claude Code, including prompt templates, custom skills, usage examples, and best practices.

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

**[docs/ai-agent-learning-path.md](./docs/ai-agent-learning-path.md)** - 适用于 Claude、GLM、Codex 的 Agent 开发学习路径：

| Level | 主题 | 时间 | 产出 |
|-------|------|------|------|
| 1 | 基础提示工程 | 1 周 | 完成单一任务 |
| 2 | Skill 技能开发 | 1 周 | 第一个可复用 Skill |
| 3 | 工作流编排 | 2 周 | 完整自动化流程 |
| 4 | 自我学习系统 | 2-3 周 | 从经验中学习的 Agent |
| 5 | 自进化 Agent | 2-3 周 | 完全自主进化 |

## Complete Workflow Example

**[docs/complete-workflow-example.md](./docs/complete-workflow-example.md)** - 从图片/需求到交付的完整流程演示：

1. **Input** → 上传图片或描述需求
2. **PRD** → `prd-planner` 创建 PRD（自动触发 `self-improving-agent`）
3. **Review** → 自我审核和改进
4. **Implement** → 根据 PRD 编写代码
5. **Review** → `code-reviewer` 检查质量
6. **Feedback** → `self-improving-agent` 从经验中学习
7. **Submit** → `create-pr` 提交并同步中英文 README

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
4. Update both README.md and README.zh-CN.md
5. Validate skill structure: `python3 scripts/validate_skills.py`
6. Optional: run skills-ref validation: `python3 -m pip install "git+https://github.com/agentskills/agentskills.git@main#subdirectory=skills-ref" && skills-ref validate skills/<name>`

## License

MIT License
