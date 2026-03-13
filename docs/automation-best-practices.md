# AI Agent 自动化最佳实践 2025

基于行业调研和主流框架（LangGraph、CrewAI、AutoGen）的最佳实践总结。

---

## 核心设计原则

### 1. Start Small, Expand Gradually

| 阶段 | 自动化范围 | 示例 |
|------|-----------|------|
| **Level 1** | 单一任务自动化 | 代码格式化、保存日志 |
| **Level 2** | 任务链自动化 | PRD → 反思 → 日志 |
| **Level 3** | 复杂工作流 | PRD → 实现 → 审查 → PR |
| **Level 4** | 自我进化 | 带反馈循环的持续改进 |

**实践建议：**
```yaml
# ❌ 不好：一开始就做全自动化
workflow: full_automation  # 太复杂，难以调试

# ✅ 好：从简单自动化开始
workflow:
  - step_1: auto_save_session
  - step_2: trigger_reflection  # 后续添加
```

### 2. Modularization（模块化）

将复杂工作流拆分为独立、可重用的模块：

```yaml
# 模块化设计
modules:
  prd_module:
    - prd-planner
    - planning-with-files

  review_module:
    - self-improving-agent
    - code-reviewer

  delivery_module:
    - create-pr
    - session-logger
```

### 3. Trigger Design（触发器设计）

#### 推荐的触发器类型

| 触发类型 | 说明 | 使用场景 |
|---------|------|---------|
| **Event-based** | 事件驱动 | 任务完成、文件创建 |
| **State-based** | 状态驱动 | 所有 checkbox 选中 |
| **Time-based** | 时间驱动 | 定期保存、轮询 |
| **Manual** | 手动触发 | 用户明确要求 |

#### 触发器实现模式

```yaml
# Event-based: 文件创建时触发
triggers:
  - event: file_created
    file: "docs/{feature}-prd.md"
    action: trigger_self_improving_agent

# State-based: 状态检查时触发
triggers:
  - check: prd_task_plan_status
    condition: all_phases_complete
    action: trigger_session_logger

# Manual: 用户显式触发
triggers:
  - manual: user_said "完成工作流"
    action: execute_remaining_steps
```

---

## 主流编排模式

### Pattern 1: ReAct（推理 + 行动）

```text
Thought → Action → Observation → Thought → Action → ...
```

适用：问题解决、调试

### Pattern 2: Reflection（反思）

```text
Action → Self-Review → Improve → Action
```

适用：PRD 改进、代码优化

### Pattern 3: Plan and Execute

```text
Plan → Execute → Review → Adjust
```

适用：复杂任务实现

### Pattern 4: Graph-based Orchestration

```text
      ┌─────┐
      │ PRD │
      └──┬──┘
         │
    ┌────┴────┬─────────┬──────────┐
    ↓         ↓         ↓          ↓
  Reflect  Implement  Review    Deploy
    │         │         │          │
    └─────────┴─────────┴──────────┘
                   ↓
              Log Session
```

适用：复杂多步骤工作流

---

## 自动化钩子设计

### 钩子类型

| 钩子 | 时机 | 用途 |
|------|------|------|
| `before` | 任务开始前 | 初始化环境、检查条件 |
| `after` | 任务完成后 | 触发下一步、清理资源 |
| `on_error` | 发生错误时 | 回滚、记录错误 |
| `on_progress` | 进度更新 | 保存中间状态 |

### 钩子实现

```yaml
# 在 SKILL.md 中定义钩子
hooks:
  before_start:
    - check: prerequisites_exist
    - create: working_files

  after_complete:
    - trigger: self-improving-agent
      mode: background
    - trigger: session-logger
      mode: auto

  on_error:
    - save: error_state
    - notify: user
```

---

## 状态管理

### 状态追踪

使用文件系统持久化状态：

```text
~/.claude/state/
├── current_workflow.json
├── skill_states/
│   ├── prd-planner.json
│   ├── self-improving-agent.json
│   └── session-logger.json
└── workflow_history.json
```

### 状态文件格式

```json
{
  "workflow_id": "prd-creation-001",
  "current_step": "prd-planner",
  "steps": [
    {"name": "prd-planner", "status": "complete"},
    {"name": "self-improving-agent", "status": "pending"},
    {"name": "session-logger", "status": "pending"}
  ],
  "context": {
    "prd_file": "docs/feature-prd.md",
    "feature_name": "user-auth"
  }
}
```

---

## 避免的反模式

| 反模式 | 问题 | 解决方案 |
|--------|------|---------|
| **过度自动化** | 难以调试、不可控 | 从小开始，逐步扩展 |
| **无限循环** | 死循环、资源耗尽 | 设置最大深度、超时 |
| **隐藏触发** | 用户不知道发生了什么 | 记录日志、显示进度 |
| **紧密耦合** | 难以修改、重用 | 模块化设计 |
| **缺少回滚** | 错误后无法恢复 | 实现 on_error 钩子 |

---

## 推荐的实现方式

### 方式 1: Front Matter 声明式钩子

```yaml
---
name: prd-planner
description: Creates PRDs using persistent file-based planning
allowed-tools: Read, Write, Edit, Bash, Grep, Glob, AskUserQuestion, WebSearch
hooks:
  after_complete:
    - trigger: self-improving-agent
      mode: background
    - trigger: session-logger
      mode: auto
---
```

### 方式 2: CLAUDE.md 全局工作流定义

```markdown
## Workflow: PRD Creation

When prd-planner completes:
1. Automatically trigger self-improving-agent (background)
2. Automatically trigger session-logger (auto)
3. Ask user if they want to create PR
```

### 方式 3: Orchestrator Skill 中央协调

由 `workflow-orchestrator` 读取配置并执行工作流。

---

## 可观测性

### 日志记录

```yaml
logging:
  level: info
  events:
    - skill_triggered
    - milestone_reached
    - hook_executed
    - error_occurred
  output: sessions/workflow-log.json
```

### 进度追踪

```markdown
## Workflow Progress

- [x] Step 1: prd-planner ✓
- [ ] Step 2: self-improving-agent (In Progress...)
- [ ] Step 3: session-logger
- [ ] Step 4: create-pr (Ask user)
```

---

## 参考资料

- [10 Best Practices for Building Reliable AI Agents in 2025](https://www.uipath.com/blog/ai/agent-builder-best-practices)
- [Automate Your Development Workflow with Kiro's AI Agent Hooks](https://kiro.dev/blog/automate-your-development-workflow-with-agent-hooks/)
- [LangChain Workflows and Agents](https://docs.langchain.com/oss/python/langgraph/workflows-agents)
- [6 Agentic AI Patterns](https://genesishumanexperience.com/2025/07/13/%F0%9F%A7%A0-6-agentic-ai-patterns-from-zero-shot-to-multi-agent-orchestration/)
- [Multi-Agent Patterns](https://strandsagents.com/latest/documentation/docs/user-guide/concepts/multi-agent/multi-agent-patterns/)
