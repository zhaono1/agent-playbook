# Complete Workflow Example: From Image to Delivery

本文档展示如何使用 agent-playbook 完成从图片需求分析到最终交付的完整流程。

## 完整工作流程图

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        COMPLETE WORKFLOW                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. INPUT           2. PRD           3. REVIEW        4. IMPLEMENT      │
│  ┌─────────┐       ┌─────────┐      ┌─────────┐     ┌─────────┐        │
│  │ Image/  │  →    │prd-planner│ →   │self-imp │  →  │dev work │        │
│  │ Request │       │          │      │-agent   │     │         │        │
│  └─────────┘       └─────────┘      └─────────┘     └─────────┘        │
│       │                  │                  │                │           │
│       ▼                  ▼                  ▼                ▼           │
│  User provides     Creates PRD      Extracts       Write code       │
│  requirement       with 4-file     patterns        & tests          │
│                    pattern          & updates       │                │
│                                         │           │                │
│                                         ▼           ▼                │
│  5. FEEDBACK LOOP          6. DELIVER                           │
│  ┌─────────────────────────────────────────────────┐                │
│  │  code-reviewer → self-imp-agent → create-pr    │                │
│  │       ↓                  ↓              ↓       │                │
│  │  Review quality    Learn from     Submit PR    │                │
│  │  & patterns        experience    with README   │                │
│  └─────────────────────────────────────────────────┘                │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## 分步示例

### 步骤 1: 输入需求（图片或文字）

**你发送：**

```
[上传一张 UI 设计图]

帮我分析这个图片，创建一个 PRD，然后实现它
```

**Claude 自动执行：**

1. **分析图片**（使用视觉能力）
   - 识别 UI 组件、布局、交互
   - 提取功能需求

2. **启动 `prd-planner`**

---

### 步骤 2: 创建 PRD

**Claude 自动调用 `prd-planner` 技能：**

```bash
# prd-planner 自动执行
Creating PRD using 4-file pattern...

✓ docs/data-refresh-prd-notes.md      # 思考过程
✓ docs/data-refresh-prd-task-plan.md  # 任务跟踪
✓ docs/data-refresh-prd.md            # 产品需求
✓ docs/data-refresh-tech.md           # 技术设计
```

**prd-planner 完成后自动触发：**
```
→ self-improving-agent (background) - 学习 PRD 模式
→ session-logger (auto) - 保存会话
```

---

### 步骤 3: 自我审核与改进

**你：**
```
审核一下这个 PRD
```

**Claude 调用 `self-improving-agent`：**

```markdown
## 自我审核结果

### 发现的问题
1. ✅ UI 规范不够详细（按钮大小、位置不明确）
2. ✅ 缺少 Non-Goals 部分
3. ✅ 成功标准需要具体数值

### 提取的模式（存储到 memory/semantic-patterns.json）
- ui_ux_specification_granularity: UI PRDs 需要明确的视觉规范
- measurable_success_criteria: 成功标准必须包含具体数字

### 自动更新的技能
- prd-planner: 添加 UI 规范检查项
- architecting-solutions: 添加视觉规范模板
```

---

### 步骤 4: 开始实施

**你：**
```
开始实现这个 PRD
```

**Claude 调用 `prd-implementation-precheck` 然后开始编码：**

```typescript
// 实现代码示例
import { IconButton, Text, XStack } from 'component-library';

export const RefreshActionButton = () => {
  const handleRefresh = useCallback(() => {
    // 根据 PRD 中的规范实现
    requestDataRefresh({ reason: 'manual' });
  }, []);

  return (
    <XStack gap="$3" alignItems="center">
      <Text variant="bodyMd">{displayValue}</Text>
      <IconButton
        iconSize="$4"  // 24px - PRD 中明确指定
        name="refresh"
        onPress={handleRefresh}
      />
    </XStack>
  );
};
```

---

### 步骤 5: 代码审核与反馈循环

**你：**
```
review 一下代码
```

**Clade 调用 `code-reviewer`：**

```markdown
## Code Review 结果

### 发现的问题
1. ❌ 缺少加载状态
2. ✅ Props 类型定义正确

### 建议改进
- 添加 loading 状态显示
- 添加错误处理
```

**审核完成后自动触发：**
```
→ self-improving-agent (background) - 学习审核模式
→ session-logger (auto) - 保存审核记录
```

---

### 步骤 6: 反馈与自我升级

**你：**
```
这次 PRD 写得不错，但 UI 规范还可以更详细
```

**Claude 调用 `self-improving-agent` 记录反馈：**

```json
// memory/episodic/2025-01-12-prd-review.json
{
  "episode": "ep-2025-01-12-001",
  "skill": "prd-planner",
  "user_feedback": {
    "rating": 8,
    "positive": "PRD 结构清晰",
    "improvement": "UI 规范需要更详细"
  },
  "pattern_extracted": "ui_ux_specification_granularity",
  "confidence": 0.90,
  "actions_taken": [
    "更新 prd-planner 检查清单",
    "添加 UI 规范模板到 architecting-solutions"
  ]
}
```

---

### 步骤 7: 提交 PR

**你：**
```
提交代码
```

**Claude 调用 `commit-helper` → `create-pr`：**

```bash
# 1. 提交代码
git add .
git commit -m "feat: add data refresh button with loading state"

# 2. 推送
git push -u origin feat/data-refresh

# 3. 创建 PR（自动更新中英文 README）
✓ PR #15 created
```

**create-pr 自动触发：**
```
→ session-logger (auto) - 记录 PR 创建
```

---

### 步骤 8: 继续迭代

**你：**
```
根据审核反馈修改代码，然后再次 review
```

**循环：**
```
修改代码 → code-reviewer → self-improving-agent → 提交
            ↓                                          ↓
      提取新的模式                                更新技能文件
```

---

## 完整对话示例

```
═══════════════════════════════════════════════════════════════
你: [上传图片]
═══════════════════════════════════════════════════════════════

Claude: 我看到了这个 UI 设计图。让我使用 prd-planner 创建 PRD...

[调用 prd-planner 技能]

✓ 创建了 4 个文件：
  - docs/data-refresh-prd-notes.md
  - docs/data-refresh-prd-task-plan.md
  - docs/data-refresh-prd.md
  - docs/data-refresh-tech.md

[后台自动触发 self-improving-agent，提取 PRD 模式]

═══════════════════════════════════════════════════════════════
你: 审核一下这个 PRD
═══════════════════════════════════════════════════════════════

Claude: [自我审核]

发现 2 个可改进点：
1. UI 规范可以更详细（按钮大小、间距）
2. 成功标准需要具体时间限制

已在 prd-planner 中添加这些检查项...

═══════════════════════════════════════════════════════════════
你: 开始实现
═══════════════════════════════════════════════════════════════

Claude: [调用 prd-implementation-precheck]

实施前检查通过，开始编码...

[编写代码]

✓ RefreshActionButton.tsx 已创建
✓ 单元测试已添加

═══════════════════════════════════════════════════════════════
你: review 一下
═══════════════════════════════════════════════════════════════

Claude: [调用 code-reviewer]

审核结果：
✅ 类型定义正确
✅ 测试覆盖完整
⚠️  建议添加错误边界

[后台自动触发 self-improving-agent，提取审核模式]

═══════════════════════════════════════════════════════════════
你: 提交代码
═══════════════════════════════════════════════════════════════

Claude: [调用 create-pr]

✓ PR 已创建: https://github.com/.../pull/15
✓ README.md 和 README.zh-CN.md 已同步更新
```

---

## 技能自动触发关系

| 触发时机 | 自动触发的技能 | 目的 |
|---------|---------------|------|
| prd-planner 完成 | self-improving-agent | 学习 PRD 模式 |
| prd-planner 完成 | session-logger | 保存会话 |
| code-reviewer 完成 | self-improving-agent | 提取代码质量模式 |
| 任何技能完成 | session-logger | 记录活动 |
| 技能文件被修改 | create-pr | 提示创建 PR |

---

## 快速开始

### 最简流程

```
1. 发送图片/需求 → prd-planner 自动创建 PRD
2. 说"实现它" → 开始编码
3. 说"review" → code-reviewer 审核
4. 说"提交" → create-pr 提交 PR
```

### 完整流程（带反馈）

```
1. 发送需求 → 创建 PRD
2. 说"审核 PRD" → self-improving-agent 改进
3. 说"实现" → 编写代码
4. 说"review" → 代码审核
5. 给反馈 → self-improving-agent 学习
6. 说"提交" → 创建 PR
```

---

## 技能文件位置

```bash
skills/
├── prd-planner/SKILL.md              # 创建 PRD
├── prd-implementation-precheck/      # 实施前检查
├── code-reviewer/SKILL.md            # 代码审核
├── self-improving-agent/SKILL.md     # 自我升级
├── create-pr/SKILL.md                # 创建 PR
└── session-logger/SKILL.md           # 会话记录
```
