# Agent Playbook

> AI Agent (Claude Code) 实用指南、提示词和技能集合

[English](./README.md) | 简体中文

## 概述

本仓库整理并存储了使用 Claude Code 等 AI Agent 的实用资源，包括提示词模板、自定义技能、使用示例和最佳实践。

本仓库只放适合公开分享、可迁移的 Agent 构建模块：可复用技能、提示词模式、工作流文档，以及面向 Claude Code、Codex、Gemini 的本地工具链。

所有内容都尽量保持抽象和可移植。私有运行细节、公司专属流程、敏感业务上下文应放在其他私有位置。

## 你可以获得什么

- 结构清晰的可复用技能：精简的 `SKILL.md` 配合更深入的 `references/`
- 通过 `@codeharbor/agent-playbook` 提供的安装与生命周期工具
- 用于技能发现的 MCP Server
- 关于规划、自我改进、自动化、上下文设计的工作流文档

## 设计原则

本仓库围绕几条可移植的 Agent 设计原则持续演进：

- 让硬约束常驻，但保持简短
- 把可复用的方法沉淀为技能
- 把详细事实、示例和长解释放进 references 或 docs，按需检索
- 把长任务状态持久化到聊天之外，让恢复更可靠

延伸阅读：

- [Agent Playbook 的上下文分层](./docs/context-layering-for-agent-playbooks.md)
- [long-task-coordinator](./skills/long-task-coordinator/)

## 适合谁使用

- 想构建自己可复用 Agent Skill 的开发者
- 想把规划、评审、恢复流程标准化的团队
- 希望使用本地优先工具而非重 SaaS 编排的高级用户

## 安装

### 方法零：一键安装（PNPM/NPM）

为 Claude Code、Codex 和 Gemini 配置技能，并接入会话日志与自我进化 hooks。

```bash
pnpm dlx @codeharbor/agent-playbook init
# 或者
npm exec -- @codeharbor/agent-playbook init
```

仅项目级安装：

```bash
pnpm dlx @codeharbor/agent-playbook init --project
```

### 方法一：符号链接（推荐）

将技能链接到全局技能目录：

```bash
# 为每个技能创建符号链接
ln -s /path/to/agent-playbook/skills/* ~/.claude/skills/
ln -s /path/to/agent-playbook/skills/* ~/.codex/skills/
ln -s /path/to/agent-playbook/skills/* ~/.gemini/skills/
```

示例：

```bash
# 链接单个技能
ln -s ~/Documents/code/GitHub/agent-playbook/skills/skill-router ~/.claude/skills/skill-router
ln -s ~/Documents/code/GitHub/agent-playbook/skills/architecting-solutions ~/.claude/skills/architecting-solutions
ln -s ~/Documents/code/GitHub/agent-playbook/skills/planning-with-files ~/.claude/skills/planning-with-files
```

### 方法二：复制技能

直接将技能复制到全局技能目录：

```bash
cp -r /path/to/agent-playbook/skills/* ~/.claude/skills/
cp -r /path/to/agent-playbook/skills/* ~/.codex/skills/
cp -r /path/to/agent-playbook/skills/* ~/.gemini/skills/
```

### 方法三：添加到项目特定技能

用于项目特定用途，在项目中创建 `.claude/.codex/.gemini` 技能目录：

```bash
mkdir -p .claude/skills .codex/skills .gemini/skills
cp -r /path/to/agent-playbook/skills/* .claude/skills/
cp -r /path/to/agent-playbook/skills/* .codex/skills/
cp -r /path/to/agent-playbook/skills/* .gemini/skills/
```

### 验证安装

列出已安装的技能：

```bash
ls -la ~/.claude/skills/
ls -la ~/.codex/skills/
ls -la ~/.gemini/skills/
```

## 技能管理

使用本地技能管理器查看并管理项目与全局范围的技能：

```bash
apb skills list --scope both --target all
apb skills add ./skills/my-skill --scope project --target claude
```

`apb` 是 `agent-playbook` 的短别名。

## 项目结构

```text
agent-playbook/
├── prompts/       # 提示词模板和示例
├── skills/        # 自定义技能文档
├── docs/          # 自动化最佳实践和示例
├── mcp-server/    # MCP 技能发现服务器
└── README.md      # 项目文档
```

## 技能目录

### 元技能（工作流与自动化）

| 技能 | 描述 | 自动触发 |
|------|------|----------|
| **[skill-router](./skills/skill-router/)** | 智能路由，将用户请求引导至最合适的技能 | 手动 |
| **[create-pr](./skills/create-pr/)** | 创建 PR 并自动更新中英文文档 | 技能更新后 |
| **[session-logger](./skills/session-logger/)** | 保存对话历史到会话日志文件 | 自动（任何技能完成后） |
| **[auto-trigger](./skills/auto-trigger/)** | 定义技能之间的自动触发关系 | 仅配置 |
| **[workflow-orchestrator](./skills/workflow-orchestrator/)** | 协调多技能工作流并触发后续操作 | 自动 |
| **[self-improving-agent](./skills/self-improving-agent/)** | 通用自我进化系统，从所有技能经验中学习 | 后台 |

### 核心开发

| 技能 | 描述 | 自动触发 |
|------|------|----------|
| **[commit-helper](./skills/commit-helper/)** | 遵循 Conventional Commits 规范的 Git 提交信息 | 手动 |
| **[code-reviewer](./skills/code-reviewer/)** | 全面审查代码质量、安全性和最佳实践 | 手动 / 实现完成后 |
| **[debugger](./skills/debugger/)** | 系统性调试和问题解决 | 手动 |
| **[refactoring-specialist](./skills/refactoring-specialist/)** | 代码重构和技术债务减少 | 手动 |

### 文档与测试

| 技能 | 描述 | 自动触发 |
|------|------|----------|
| **[documentation-engineer](./skills/documentation-engineer/)** | 技术文档和 README 编写 | 手动 |
| **[api-documenter](./skills/api-documenter/)** | OpenAPI/Swagger API 文档 | 手动 |
| **[test-automator](./skills/test-automator/)** | 自动化测试框架设置和测试创建 | 手动 |
| **[qa-expert](./skills/qa-expert/)** | 质量保证策略和质量标准 | 手动 |

### 架构与运维

| 技能 | 描述 | 自动触发 |
|------|------|----------|
| **[api-designer](./skills/api-designer/)** | REST 和 GraphQL API 架构设计 | 手动 |
| **[security-auditor](./skills/security-auditor/)** | 覆盖 OWASP Top 10 的安全审计 | 手动 |
| **[performance-engineer](./skills/performance-engineer/)** | 性能优化和分析 | 手动 |
| **[deployment-engineer](./skills/deployment-engineer/)** | CI/CD 流水线和部署自动化 | 手动 |

### 规划与架构

| 技能 | 描述 | 自动触发 |
|------|------|----------|
| **[prd-planner](./skills/prd-planner/)** | 使用持久化文件规划创建 PRD | 手动（关键词："PRD"） |
| **[prd-implementation-precheck](./skills/prd-implementation-precheck/)** | 实现 PRD 前进行预检查 | 手动 |
| **[architecting-solutions](./skills/architecting-solutions/)** | 技术方案和架构设计 | 手动（关键词："design solution"） |
| **[planning-with-files](./skills/planning-with-files/)** | 通用的多步骤任务文件规划 | 手动 |
| **[long-task-coordinator](./skills/long-task-coordinator/)** | 用持久化状态和恢复规则协调跨会话或委派执行的长任务 | 手动 |

### 设计与创意

| 技能 | 描述 | 自动触发 |
|------|------|----------|
| **[figma-designer](./skills/figma-designer/)** | 分析 Figma 设计并生成包含视觉规范的实现就绪 PRD | 手动（Figma 链接） |

## 自动触发机制

技能完成时可以自动触发其他技能，形成工作流：

```
┌──────────────┐
│  prd-planner │ 完成
└──────┬───────┘
       │
       ├──→ self-improving-agent (后台) → 学习 PRD 模式
       │         └──→ create-pr (询问) ──→ session-logger (自动)
       │
       └──→ session-logger (自动)
```

### 自动触发模式

| 模式 | 行为 |
|------|------|
| `auto` | 立即执行，阻塞直到完成 |
| `background` | 后台运行，不等待结果 |
| `ask_first` | 执行前询问用户 |

## 使用方法

安装后，技能在任何 Claude Code 会话中自动可用。你可以通过以下方式调用：

1. **直接激活** - 技能根据上下文自动激活（例如提到 "PRD"、"planning"）
2. **手动调用** - 明确要求 Claude 使用特定技能

示例：

```
你：帮我创建一个新认证功能的 PRD
```

`prd-planner` 技能将自动激活。

## 工作流示例

完整的 PRD 到实现工作流：

```
用户："帮我创建用户认证的 PRD"
       ↓
prd-planner 执行
       ↓
阶段完成 → 自动触发：
       ├──→ self-improving-agent (后台) - 提取模式
       └──→ session-logger (自动) - 保存会话
       ↓
用户："实现这个 PRD"
       ↓
prd-implementation-precheck → 实现
       ↓
code-reviewer → self-improving-agent → create-pr
```

## AI Agent 学习路径

**[docs/ai-agent-learning-path.md](./docs/ai-agent-learning-path.md)** - 适用于 Claude、GLM、Codex 的渐进式 Agent 开发学习路径：

| Level | 主题 | 时间 | 产出 |
|-------|------|------|------|
| 1 | 提示工程基础 | 1 周 | 完成单一任务工作流 |
| 2 | Skill 开发 | 1 周 | 交付第一个可复用 Skill |
| 3 | 工作流编排 | 2 周 | 构建完整自动化流程 |
| 4 | 自学习系统 | 2-3 周 | 让 Agent 能从经验中学习 |
| 5 | 自进化 Agent | 2-3 周 | 构建更自主的改进闭环 |

## 完整工作流示例

**[docs/complete-workflow-example.md](./docs/complete-workflow-example.md)** - 从输入或设计参考到最终交付的端到端示例：

1. **Input** → 上传图片或描述需求
2. **PRD** → `prd-planner` 创建 PRD，并可触发 `self-improving-agent`
3. **Review** → 评审并打磨方案
4. **Implement** → 按照 PRD 实现
5. **Review** → `code-reviewer` 检查质量
6. **Feedback** → `self-improving-agent` 从结果中学习
7. **Submit** → `create-pr` 创建 PR，并保持中英文文档同步

## 更新技能

当你更新 agent-playbook 中的技能时，符号链接确保你始终使用最新版本。更新方法：

```bash
cd /path/to/agent-playbook
git pull origin main
```

如果使用复制的技能，重新复制更新的文件：

```bash
cp -r /path/to/agent-playbook/skills/* ~/.claude/skills/
```

## 贡献

欢迎贡献！欢迎提交包含你自己的提示词、技能或用例的 PR。

贡献技能时：

1. 将你的技能添加到上面技能目录的相应类别
2. 包含 `SKILL.md` 文件，格式正确（name, description, allowed-tools, hooks）
3. 添加 `README.md` 包含使用示例
4. 保持 `SKILL.md` 精简，把长流程、模板和详细说明放进 `references/`
5. 优先写抽象、可移植的内容，不要写私有或业务专属知识
6. 为技能加入明确的验收标准，让完成条件清晰
7. 在可行时，为新技能补轻量 eval prompts 或场景检查
8. 参考 [Anthropic 官方 skill-creator](https://github.com/anthropics/skills/tree/main/skills/skill-creator) 的结构与规范
9. 在需要中英文同步时，同时更新 README.md 和 README.zh-CN.md
10. 验证技能结构：`python3 scripts/validate_skills.py`
11. 可选：运行 skills-ref 校验：`python3 -m pip install "git+https://github.com/agentskills/agentskills.git@main#subdirectory=skills-ref" && skills-ref validate skills/<name>`

## 许可证

MIT License
