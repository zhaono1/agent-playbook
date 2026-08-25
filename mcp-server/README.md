# Agent Playbook MCP Server

A Model Context Protocol (MCP) server that exposes agent-playbook skills as
portable discovery tools. Claude Code is the documented setup example; any MCP
client with stdio transport support can use the same tool contract.

## Features

- **list_skills** - List all available skills with filtering by category
- **get_skill** - Get detailed information about a specific skill
- **search_skills** - Search for skills by keyword
- **get_skill_hooks** - Get declarative hook metadata; execution remains host-dependent

The server intentionally advertises tools only. Skill files remain the source
of truth; it does not claim MCP resources or expose host filesystem paths.

## Installation

### Step 1: Install Dependencies

```bash
cd mcp-server
npm install
```

### Step 2: Configure Claude Code

Register the server with Claude Code:

```bash
claude mcp add agent-playbook -- \
  node /path/to/agent-playbook/mcp-server/index.js
```

For checked-in project configuration, place the server in `.mcp.json`. User and
local-scope MCP server entries are stored by Claude Code in `~/.claude.json`.
The server object is:

```json
{
  "mcpServers": {
    "agent-playbook": {
      "command": "node",
      "args": ["/path/to/agent-playbook/mcp-server/index.js"]
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
| `meta` | skill-router, create-pr, session-logger, workflow-orchestrator, self-improving-agent, auto-trigger |
| `core` | commit-helper, code-reviewer, debugger, refactoring-specialist |
| `docs` | documentation-engineer, api-documenter, test-automator, qa-expert |
| `architecture` | api-designer, security-auditor, performance-engineer, deployment-engineer |
| `planning` | prd-planner, prd-implementation-precheck, architecting-solutions, planning-with-files, long-task-coordinator |
| `design` | figma-designer |

## Benefits

With MCP integration, Claude Code can:
- Dynamically discover available skills
- Understand skill relationships and hooks
- Access skill descriptions without hardcoded prompts
- Provide better skill recommendations

## Compatibility Policy

The MCP adapter version follows the Agent Playbook release version. Tool name,
input-schema, or response-shape changes are documented in the repository
changelog. MCP protocol compatibility is governed by the locked SDK version and
verified by the server test suite.

## References

- [Connect Claude Code to tools via MCP](https://code.claude.com/docs/en/mcp)
- [Build an MCP server](https://modelcontextprotocol.io/docs/develop/build-server)
- [Ultimate Guide to Claude MCP Servers](https://generect.com/blog/claude-mcp/)
