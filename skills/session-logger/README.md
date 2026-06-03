# Session Logger

Automatically saves conversation history to persistent session log files.

## Overview

Session Logger captures your conversations with Claude Code so you can:
- Reference previous decisions and context
- Maintain continuity across sessions
- Learn from past problem-solving approaches
- Track project evolution

## Installation

```bash
mkdir -p ~/.claude/skills
ln -s ~/Documents/code/GitHub/agent-playbook/skills/session-logger ~/.claude/skills/session-logger
```

## Usage

Simply say:

```
"保存对话信息"
```

The skill will automatically:
1. Review the conversation
2. Extract key information
3. Create a session log in `sessions/`

## Trigger Phrases

| 中文 | English |
|------|---------|
| 保存对话信息 | save session |
| 保存本次对话 | save conversation |
| 记录会话内容 | log session |
| 保存session | save this session |

## Session File Location

```
sessions/YYYY-MM-DD-{topic}.md
```

## Privacy

Session logs are in `.gitignore` - they are NOT committed to git.
