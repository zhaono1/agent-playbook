# AI Agent 学习路径

> 适用于 Claude、GLM、Codex 等多种 AI 平台的 Agent 开发指南

本文档提供了一条从入门到精通的 AI Agent 开发学习路径，适用于：
- **Claude Code** (Anthropic)
- **GLM Code** (智谱 GLM-4-All Tools)
- **Codex** (OpenAI/GitHub Copilot)

## 学习路径概览

```
┌─────────────────────────────────────────────────────────────────┐
│                      AI AGENT LEARNING PATH                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Level 1    Level 2    Level 3    Level 4    Level 5           │
│  ┌─────┐   ┌─────┐   ┌─────┐   ┌─────┐   ┌─────┐             │
│  │基础 │ → │技能 │ → │编排 │ → │学习 │ → │进化 │             │
│  │提示 │   │开发 │   │协作 │   │系统 │   │Agent│             │
│  └─────┘   └─────┘   └─────┘   └─────┘   └─────┘             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Level 1: 基础提示工程

### 目标
掌握基本的 Prompt 编写技巧，让 AI 完成单一任务。

### 学习内容

| 主题 | 关键点 | 练习 |
|------|--------|------|
| **清晰指令** | 明确描述任务，避免歧义 | 让 AI 写一个函数 |
| **上下文提供** | 提供必要的背景信息 | 给代码上下文让 AI 解释 |
| **输出格式** | 指定期望的输出格式 | 要求输出 JSON/Markdown |
| **迭代优化** | 根据输出调整 Prompt | 多轮对话完成任务 |

### 练习项目

```
项目 1: 代码解释器
- 输入: 一段代码
- 输出: 代码功能解释
- 技能: 基础提示 + 上下文

项目 2: 文档生成器
- 输入: 代码/函数
- 输出: 格式化的文档
- 技能: 输出格式控制

项目 3: Bug 定位助手
- 输入: 错误信息 + 代码
- 输出: 可能的原因和修复建议
- 技能: 问题分析 + 上下文
```

### 平台差异

| 特性 | Claude | GLM | Codex |
|------|--------|-----|-------|
| 代码理解 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| 中文支持 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| 工具调用 | 原生支持 | GLM-4-All Tools | 需封装 |
| 上下文窗口 | 200K tokens | 128K tokens | 取决于版本 |

---

## Level 2: Skill 技能开发

### 目标
创建可复用的 "Skill"（技能/插件），让 AI 执行专门任务。

### 核心概念

#### 什么是 Skill？

Skill 是一个**可复用的提示词模板**，定义了 AI 如何处理特定类型的任务。

```markdown
---
name: code-reviewer
description: 代码审核技能
tools: Read, Grep, Edit
---

# Code Reviewer

## 任务
审核代码质量、安全性和最佳实践

## 检查项
- [ ] 代码规范
- [ ] 安全漏洞
- [ ] 性能问题
- [ ] 测试覆盖
```

### Skill 结构

```
skill-name/
├── SKILL.md          # 技能定义（必需）
├── README.md         # 使用文档（可选）
├── config.json       # 配置（可选）
└── references/       # 参考资料（可选）
```

### 练习项目

```
项目 1: 提交信息生成器
- 技能: commit-helper
- 输入: 代码变更
- 输出: Conventional Commits 格式的提交信息

项目 2: API 文档生成器
- 技能: api-documenter
- 输入: API 代码
- 输出: OpenAPI/Swagger 规范

项目 3: 单元测试生成器
- 技能: test-automator
- 输入: 函数代码
- 输出: 单元测试代码
```

---

## Level 3: 工作流编排

### 目标
将多个 Skill 组合成完整的工作流，实现复杂任务的自动化。

### 核心概念

#### Hook 后续动作 (Auto-Trigger Metadata)

当一个 Skill 完成时，可以在 hook 元数据中声明后续动作。是否立即执行取决于宿主运行时支持和动作风险：

```yaml
hooks:
  after_complete:
    - trigger: code-reviewer
      mode: auto
    - trigger: session-logger
      mode: auto
```

#### 触发模式

| 模式 | 行为 | 使用场景 |
|------|------|----------|
| `auto` | 宿主可执行或记录低风险后续动作 | 保存会话 |
| `background` | 后台运行，不等待 | 学习模式 |
| `ask_first` | 询问用户后执行 | 创建 PR |

### 工作流示例

```
PRD 创建工作流:
┌──────────────┐
│ prd-planner  │ 完成
└──────┬───────┘
       │
       ├──→ self-improving-agent (background) - 学习 PRD 模式
       └──→ session-logger (auto) - 保存会话

代码审核工作流:
┌──────────────┐
│ code-reviewer │ 完成
└──────┬───────┘
       │
       ├──→ self-improving-agent (background) - 学习审核模式
       └──→ session-logger (auto) - 保存审核记录
```

### 练习项目

```
项目 1: 自动化 PR 流程
- prd-planner → 实现 → code-reviewer → create-pr

项目 2: 文档同步流程
- 修改代码 → 提取变更 → 更新 EN README → 更新 CN README

项目 3: 质量门禁流程
- 代码提交 → test-automator → qa-expert → 通过/拒绝
```

---

## Level 4: 自我学习系统

### 目标
构建能从证据中形成候选经验，并通过验证改变未来行为的 Agent。

### 核心架构

```
失败 / 纠正 / 已验证成功
          ↓
隐私安全的事件摘要
          ↓
去重候选（candidate）
          ↓
代表性任务 + 可证伪检查
          ↓
validate / observe / reject
          ↓
apply 到最窄的 durable owner
          ↓
回归验证 / supersede / rollback
```

### 状态与责任

| 状态 | 含义 | 是否改变 Agent 行为 |
|------|------|----------------------|
| `candidate` | 有复用价值但证据不足 | 否 |
| `observe` | 继续收集独立证据 | 否 |
| `validated` | 已通过可审计的代表性验证 | 否 |
| `applied` | 已写入唯一责任源并记录变更引用 | 是 |
| `rejected` | 被证伪、不安全或过于具体 | 否 |
| `superseded` / `rolled_back` | 已被替代或回滚 | 否 |

### 实现示例

```bash
apb self-improve capture \
  --kind correction \
  --summary "使用缓存结论前先核对当前权威来源" \
  --evidence "focused-test"

apb self-improve list
```

此时只产生候选，不修改 skill。先编写并运行可执行 Eval Artifact，再使用 CLI
生成的通过结果进行验证：

```bash
apb self-improve eval cand-... --artifact behavior-eval.json

apb self-improve review cand-... \
  --decision validate \
  --reason "代表性回归测试通过" \
  --eval-result /path/to/eval-result.json
```

只有把变化写进最窄的 durable owner 后，才显式标记为 applied：

```bash
apb self-improve review cand-... \
  --decision apply \
  --reason "规则已写入唯一责任源并完成回测" \
  --owner "skills/example/SKILL.md" \
  --change-ref "commit-or-pr-reference"
```

真正的衡量标准不是“写了多少 memory”，而是代表性任务是否稳定改善、
错误率是否下降，以及规则能否被审计和回滚。

---

## Level 5: 跨 Harness 的改进系统

### 目标
把同一套学习策略接入多个 Harness，同时保持宿主能力边界和人工验证门槛。

### 核心能力

| 能力 | 描述 | 实现方式 |
|------|------|----------|
| **可移植 Skill** | 判断流程不绑定某个 Harness | Agent Skills 兼容目录 |
| **薄适配器** | 只翻译宿主事件和能力 | Claude hook、DeepSeek provider 等 |
| **统一状态机** | 候选、评审、提升语义一致 | 本地 lifecycle core |
| **知识汇出** | Obsidian 等仅作为派生 sink | 幂等 Markdown export |
| **版本适应** | 不假设宿主拥有未公开能力 | 当前文档核验 + 兼容测试 |

### 完整生命周期

```
Host event → Adapter → Candidate core → Human/eval gate → Durable owner
                 ↓              ↓                 ↓
           capability check   audit log      regression proof
```

关键原则：Harness 变强后，playbook 的价值不再是替 Agent 模拟推理，而是提供
可移植约束、评测、证据门槛和跨宿主一致的治理。不要以“完全无人干预”为目标；
高影响规则的错误自动提升，会把一次偶然失败放大成系统性行为偏差。

---

## 平台特定指南

### Claude Code

**优势：**
- 原生支持 Skills 和 Hooks
- 大上下文窗口 (200K)
- 优秀的代码理解能力

**快速开始：**
```bash
# 安装 Skills
ln -s ~/agent-playbook/skills/* ~/.claude/skills/

# 配置 Hooks（可选）
~/.claude/settings.json
```

### GLM Code (智谱)

**优势：**
- 中文理解最强
- GLM-4-All Tools 支持工具调用
- 128K 上下文窗口

**快速开始：**
```python
# GLM 工具调用示例
from zhipuai import ZhipuAI

client = ZhipuAI(api_key="...")

# 定义 Skill 作为系统提示
skill = open("skills/prd-planner/SKILL.md").read()

response = client.chat.completions.create(
    model="glm-4-all-tools",
    messages=[
        {"role": "system", "content": skill},
        {"role": "user", "content": "帮我创建用户认证的 PRD"}
    ],
    tools=[...],  # 工具定义
)
```

### OpenAI Codex / OpenAI API

**优势：**
- Codex 面向代码任务和本地/云端开发工作流
- 代码生成能力极强
- 丰富的生态支持

**快速开始：**
```python
# OpenAI Responses API + tools
from openai import OpenAI

client = OpenAI()

skill = open("skills/prd-planner/SKILL.md").read()

tools = [
    {
        "type": "function",
        "name": "write_prd_file",
        "description": "Write the generated PRD to a markdown file.",
        "parameters": {
            "type": "object",
            "properties": {
                "path": {"type": "string"},
                "content": {"type": "string"}
            },
            "required": ["path", "content"],
            "additionalProperties": False
        },
        "strict": True
    }
]

response = client.responses.create(
    model="gpt-5.5",
    instructions=skill,
    input=[
        {"role": "user", "content": "创建用户认证 PRD"}
    ],
    tools=tools,
)
```

---

## 学习资源

### 通用
- [Anthropic Prompt Engineering Guide](https://docs.anthropic.com/claude/docs/prompt-engineering)
- [OpenAI Prompt Engineering Guide](https://platform.openai.com/docs/guides/prompt-engineering)
- [智谱 AI 开发平台](https://open.bigmodel.cn/dev/api)

### 本仓库
- [skills/](../skills/) - 20+ 生产就绪的 Skills
- [docs/complete-workflow-example.md](./complete-workflow-example.md) - 完整工作流示例
- [docs/automation-best-practices.md](./automation-best-practices.md) - 自动化最佳实践

---

## 行动计划

### Week 1-2: Level 1-2
- [ ] 完成基础提示工程练习
- [ ] 创建第一个 Skill（如 commit-helper）
- [ ] 测试不同平台的兼容性

### Week 3-4: Level 3
- [ ] 学习 Hooks 和后续动作元数据
- [ ] 构建第一个完整工作流
- [ ] 实现多 Skill 协作

### Week 5-8: Level 4-5
- [ ] 实现多记忆系统
- [ ] 构建自我改进循环
- [ ] 添加进化标记和修正机制

---

## 总结

| Level | 主题 | 时间 | 产出 |
|-------|------|------|------|
| 1 | 基础提示 | 1 周 | 能用 AI 完成单一任务 |
| 2 | Skill 开发 | 1 周 | 第一个可复用 Skill |
| 3 | 工作流编排 | 2 周 | 完整的自动化流程 |
| 4 | 自我学习 | 2-3 周 | 能从经验中学习的 Agent |
| 5 | 自进化 | 2-3 周 | 完全自主进化的 Agent |

**总时间：8-10 周** → 成为 AI Agent 开发专家
