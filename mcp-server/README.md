# Agent Playbook MCP Server

A Model Context Protocol (MCP) server that exposes agent-playbook skills as tools and resources to Claude Code.

## Features

- **list_skills** - List all available skills with filtering by category
- **get_skill** - Get detailed information about a specific skill
- **search_skills** - Search for skills by keyword
- **get_skill_hooks** - Get auto-trigger hooks for a skill

## Installation

### Step 1: Install Dependencies

```bash
cd mcp-server
npm install
```

### Step 2: Configure Claude Code

Add to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "agent-playbook": {
      "command": "node",
      "args": ["/path/to/agent-playbook/mcp-server/index.js"],
      "cwd": "/path/to/agent-playbook/mcp-server"
    }
  }
}
```

### Step 3: Restart Claude Code

Restart Claude Code to load the MCP server.

## Usage Examples

### List All Skills

```
You: What skills are available?

Claude: I'll check the agent-playbook MCP server...

[list_skills call returns all skills with categories]
```

### Search for a Skill

```
You: I need help with debugging

Claude: Let me search for debugging skills...

[search_skills query="debug" returns debugger skill]
```

### Get Skill Details

```
You: Tell me about the prd-planner skill

Claude: [get_skill skill_name="prd-planner"]

Returns: Full description, allowed tools, hooks
```

### Check Skill Hooks

```
You: What happens after prd-planner completes?

Claude: [get_skill_hooks skill_name="prd-planner"]

Returns: Full hook configuration, including `after_complete`
```

## Available Tools

| Tool | Description |
|------|-------------|
| `list_skills` | List all skills, optionally filtered by category |
| `get_skill` | Get detailed info about a specific skill |
| `search_skills` | Search skills by keyword |
| `get_skill_hooks` | Get the parsed hook configuration for a skill |

## Categories

| Category | Skills |
|----------|--------|
| `meta` | skill-router, create-pr, session-logger, workflow-orchestrator, self-improving-agent |
| `core` | commit-helper, code-reviewer, debugger, refactoring-specialist |
| `docs` | documentation-engineer, api-documenter, test-automator, qa-expert |
| `architecture` | api-designer, security-auditor, performance-engineer, deployment-engineer |
| `planning` | prd-planner, prd-implementation-precheck, architecting-solutions, planning-with-files |
| `design` | figma-designer |

## Benefits

With MCP integration, Claude Code can:
- Dynamically discover available skills
- Understand skill relationships and hooks
- Access skill descriptions without hardcoded prompts
- Provide better skill recommendations

## References

- [Connect Claude Code to tools via MCP](https://code.claude.com/docs/en/mcp)
- [Build an MCP server](https://modelcontextprotocol.io/docs/develop/build-server)
- [Ultimate Guide to Claude MCP Servers](https://generect.com/blog/claude-mcp/)
