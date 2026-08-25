# Agent Playbook

> 面向 Coding Agent 的可移植技能、本地生命周期工具和工作流模式

[English](./README.md) | 简体中文

## 概述

本仓库整理并存储了使用 Claude Code 等 AI Agent 的实用资源，包括提示词模板、自定义技能、使用示例和最佳实践。

本仓库只放适合公开分享、可迁移的 Agent 构建模块：可复用技能、提示词模式、工作流文档，以及面向 Claude Code、Codex、Gemini、DeepSeek Harness 的本地工具链。

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
- [Skill 生态参考](./docs/skill-ecosystem-references.md)
- [集成与产品化路线图](./docs/integrations-and-product-roadmap.md)
- [long-task-coordinator](./skills/long-task-coordinator/)

## 适合谁使用

- 想构建自己可复用 Agent Skill 的开发者
- 想把规划、评审、恢复流程标准化的团队
- 希望使用本地优先工具而非重 SaaS 编排的高级用户

## 安装

### 方法零：一键安装（PNPM/NPM）

为 Claude Code、Codex、Gemini 和 DeepSeek Harness 配置技能。目前会为
Claude Code 接入有界、脱敏且默认私有的会话摘要与失败捕获，为 Codex 写入
`agent_playbook` 元数据块，并为其他宿主准备技能目录。

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
mkdir -p ~/.claude/skills ~/.codex/skills ~/.gemini/skills ~/.dsh/skills
for skill in /path/to/agent-playbook/skills/*; do
  [ -f "$skill/SKILL.md" ] || continue
  ln -s "$skill" ~/.claude/skills/
  ln -s "$skill" ~/.codex/skills/
  ln -s "$skill" ~/.gemini/skills/
  ln -s "$skill" ~/.dsh/skills/
done
```

示例：

```bash
# 链接单个技能
ln -s /path/to/agent-playbook/skills/skill-router ~/.claude/skills/skill-router
ln -s /path/to/agent-playbook/skills/architecting-solutions ~/.claude/skills/architecting-solutions
ln -s /path/to/agent-playbook/skills/planning-with-files ~/.claude/skills/planning-with-files
```

### 方法二：复制技能

直接将技能复制到全局技能目录：

```bash
mkdir -p ~/.claude/skills ~/.codex/skills ~/.gemini/skills ~/.dsh/skills
for skill in /path/to/agent-playbook/skills/*; do
  [ -f "$skill/SKILL.md" ] || continue
  cp -R "$skill" ~/.claude/skills/
  cp -R "$skill" ~/.codex/skills/
  cp -R "$skill" ~/.gemini/skills/
  cp -R "$skill" ~/.dsh/skills/
done
```

### 方法三：添加到项目特定技能

用于项目特定用途，在项目中创建各宿主的技能目录：

```bash
mkdir -p .claude/skills .codex/skills .gemini/skills .dsh/skills
for skill in /path/to/agent-playbook/skills/*; do
  [ -f "$skill/SKILL.md" ] || continue
  cp -R "$skill" .claude/skills/
  cp -R "$skill" .codex/skills/
  cp -R "$skill" .gemini/skills/
  cp -R "$skill" .dsh/skills/
done
```

### 验证安装

列出已安装的技能：

```bash
ls -la ~/.claude/skills/
ls -la ~/.codex/skills/
ls -la ~/.gemini/skills/
ls -la ~/.dsh/skills/
```

## 技能管理

使用本地技能管理器查看并管理项目与全局范围的技能：

```bash
apb skills list --scope both --target all
apb skills add ./skills/my-skill --scope project --target claude
apb skills add ./skills/my-skill --scope project --target deepseek
```

`apb` 是 `agent-playbook` 的短别名。

## 可验证的自我改进

先捕获可复用纠正并用代表性证据验证；只有唯一的 durable owner 真正发生
变化并完成回测后，才记录为 applied：

```bash
apb self-improve capture --kind correction --summary "使用缓存状态前先核对当前权威来源" --evidence "focused-test"
apb self-improve list
apb self-improve review cand-... --decision validate --reason "回归测试通过" --validation-method focused-test --validation-evidence "test:self-improvement"
apb self-improve review cand-... --decision apply --reason "已写入唯一责任源" --owner "skill:self-improving-agent" --change-ref "commit:abc123"
```

可以把评审结果导出到 Obsidian 或其他本地 Markdown 知识系统：

```bash
apb self-improve export --output /path/to/vault/Agent/Learning.md
```

Claude 自动捕获只观察失败事件，不保存原始工具输入或输出。详见
[自我改进示例](./docs/self-improvement-example.md)。

## 平台支持情况

| 平台 | 技能安装 | Hook / 配置自动化 | 当前状态 |
|------|----------|-------------------|----------|
| Claude Code | 支持 | 自动安装 SessionEnd 与 PostToolUseFailure hooks | 完整 |
| Codex | 支持 | 向 `~/.codex/config.toml` 写入 `agent_playbook` 元数据块 | 部分支持 |
| Gemini | 支持 | 暂无 hook 自动接入 | 仅技能分发 |
| DeepSeek Harness | 支持 | 暂无 hook 自动接入 | 仅技能分发 |

MCP server 是独立的可选集成，目前以 Claude Code 作为配置示例，但工具契约
可供任何支持 stdio MCP 的客户端使用。

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

### 元技能（工作流与协调）

| 技能 | 描述 | 后续动作 |
|------|------|----------|
| **[skill-router](./skills/skill-router/)** | 智能路由，将用户请求引导至最合适的技能 | 手动 |
| **[create-pr](./skills/create-pr/)** | 创建 PR 并检查中英文文档同步 | 提交时 |
| **[session-logger](./skills/session-logger/)** | 保存对话历史到会话日志文件 | 由宿主 hook 支持 |
| **[auto-trigger](./skills/auto-trigger/)** | 记录技能之间的后续动作 hook 元数据 | 仅配置 |
| **[workflow-orchestrator](./skills/workflow-orchestrator/)** | 协调多技能工作流并记录受支持的后续动作 | 手动 / 由宿主 hook 支持 |
| **[self-improving-agent](./skills/self-improving-agent/)** | 捕获隐私安全的候选经验，只提升已验证规则 | 失败 hook / 手动评审 |

### 核心开发

| 技能 | 描述 | 后续动作 |
|------|------|----------|
| **[commit-helper](./skills/commit-helper/)** | 遵循 Conventional Commits 规范的 Git 提交信息 | 手动 |
| **[code-reviewer](./skills/code-reviewer/)** | 全面审查代码质量、安全性和最佳实践 | 手动 / 实现完成后 |
| **[debugger](./skills/debugger/)** | 系统性调试和问题解决 | 手动 |
| **[refactoring-specialist](./skills/refactoring-specialist/)** | 代码重构和技术债务减少 | 手动 |

### 文档与测试

| 技能 | 描述 | 后续动作 |
|------|------|----------|
| **[documentation-engineer](./skills/documentation-engineer/)** | 技术文档和 README 编写 | 手动 |
| **[api-documenter](./skills/api-documenter/)** | OpenAPI/Swagger API 文档 | 手动 |
| **[test-automator](./skills/test-automator/)** | 自动化测试框架设置和测试创建 | 手动 |
| **[qa-expert](./skills/qa-expert/)** | 质量保证策略和质量标准 | 手动 |

### 架构与运维

| 技能 | 描述 | 后续动作 |
|------|------|----------|
| **[api-designer](./skills/api-designer/)** | REST 和 GraphQL API 架构设计 | 手动 |
| **[security-auditor](./skills/security-auditor/)** | 覆盖 OWASP Top 10 的安全审计 | 手动 |
| **[performance-engineer](./skills/performance-engineer/)** | 性能优化和分析 | 手动 |
| **[deployment-engineer](./skills/deployment-engineer/)** | CI/CD 流水线和部署自动化 | 手动 |

### 规划与架构

| 技能 | 描述 | 后续动作 |
|------|------|----------|
| **[prd-planner](./skills/prd-planner/)** | 使用持久化文件规划创建 PRD | 手动（关键词："PRD"） |
| **[prd-implementation-precheck](./skills/prd-implementation-precheck/)** | 实现 PRD 前进行预检查 | 手动 |
| **[architecting-solutions](./skills/architecting-solutions/)** | 技术方案和架构设计 | 手动（关键词："design solution"） |
| **[planning-with-files](./skills/planning-with-files/)** | 通用的多步骤任务文件规划 | 手动 |
| **[long-task-coordinator](./skills/long-task-coordinator/)** | 用持久化状态和恢复规则协调跨会话或委派执行的长任务 | 手动 |

### 设计与创意

| 技能 | 描述 | 后续动作 |
|------|------|----------|
| **[figma-designer](./skills/figma-designer/)** | 分析 Figma 设计并生成包含视觉规范的实现就绪 PRD | 手动（Figma 链接） |

## Hook 后续动作机制

技能可以在 `metadata.hooks` 中声明后续动作意图。宿主运行时或 agent
可以基于这些元数据执行低风险动作、记录待处理后续动作，或在创建 PR
这类外部动作前先询问用户。

```
┌──────────────┐
│  prd-planner │ 完成
└──────┬───────┘
       │
       ├──→ self-improving-agent（声明的后台后续动作；取决于宿主）
       │         └──→ create-pr (询问) ──→ session-logger (如宿主支持)
       │
       └──→ session-logger (如宿主支持)
```

### 后续动作模式

| 模式 | 行为 |
|------|------|
| `auto` | 宿主可以执行或记录低风险后续动作 |
| `background` | 宿主可以记录非阻塞分析或提案工作 |
| `ask_first` | 执行前询问用户 |

## 使用方法

安装后，各宿主会按自己的运行时规则发现技能。显式调用是跨宿主可移植的
行为：

1. **宿主发现** - 宿主可根据描述和上下文选择技能
2. **显式调用** - 明确要求当前 Agent 使用某个技能

示例：

```
你：帮我创建一个新认证功能的 PRD
```

请为这个请求使用 `prd-planner`。是否自动激活由宿主决定。

## 工作流示例

完整的 PRD 到实现工作流：

```
用户："帮我创建用户认证的 PRD"
       ↓
prd-planner 执行
       ↓
阶段完成 → 声明的后续动作（取决于宿主）：
       ├──→ self-improving-agent (后台) - 可写入提案
       └──→ session-logger (如宿主支持) - 保存会话
       ↓
用户："实现这个 PRD"
       ↓
prd-implementation-precheck → 实现
       ↓
code-reviewer → 可选的学习候选
       ↓
create-pr（仅当用户要求提交审核时）
```

## AI Agent 学习路径

**[docs/ai-agent-learning-path.md](./docs/ai-agent-learning-path.md)** - 构建可移植、可验证 Agent 工作流的渐进式学习路径：

| Level | 主题 | 时间 | 产出 |
|-------|------|------|------|
| 1 | 提示工程基础 | 1 周 | 完成单一任务工作流 |
| 2 | Skill 开发 | 1 周 | 交付第一个可复用 Skill |
| 3 | 工作流编排 | 2 周 | 构建完整自动化流程 |
| 4 | 可验证学习系统 | 2-3 周 | 把证据转化为经评审的行为变化 |
| 5 | 跨 Harness 改进 | 2-3 周 | 通过薄适配器共享同一学习闭环 |

## 完整工作流示例

**[docs/complete-workflow-example.md](./docs/complete-workflow-example.md)** - 从输入或设计参考到最终交付的端到端示例：

1. **Input** → 上传图片或描述需求
2. **PRD** → `prd-planner` 创建 PRD，并可记录 `self-improving-agent` 后续动作
3. **Review** → 评审并打磨方案
4. **Implement** → 按照 PRD 实现
5. **Review** → `code-reviewer` 检查质量
6. **Feedback** → `self-improving-agent` 捕获学习产物并提出更新
7. **Submit** → `create-pr` 创建 PR，并保持中英文文档同步

## 更新技能

当你更新 agent-playbook 中的技能时，符号链接确保你始终使用最新版本。更新方法：

```bash
cd /path/to/agent-playbook
git pull origin main
```

如果使用复制的技能，通过 CLI 刷新，保持所有目标一致：

```bash
apb skills upgrade --scope both --target all
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
9. 新增 skill 基础设施前，先查看 [Skill 生态参考](./docs/skill-ecosystem-references.md)
10. 在需要中英文同步时，同时更新 README.md 和 README.zh-CN.md
11. 验证技能结构：`python3 scripts/validate_skills.py`
12. 可选：运行 skills-ref 校验：`python3 -m pip install "git+https://github.com/agentskills/agentskills.git@5d4c1fda3f786fff826c7f56b6cb3341e7f3a911#subdirectory=skills-ref" && skills-ref validate skills/<name>`

## 许可证

MIT License
