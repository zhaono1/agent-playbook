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
│  User provides     Creates PRD      Records        Write code       │
│  requirement       with 4-file     patterns        & tests          │
│                    pattern          as proposals    │                │
│                                         │           │                │
│                                         ▼           ▼                │
│  5. FEEDBACK LOOP          6. DELIVER                           │
│  ┌─────────────────────────────────────────────────┐                │
│  │  code-reviewer → self-imp-agent → create-pr    │                │
│  │       ↓                  ↓              ↓       │                │
│  │  Review quality    Capture       Submit PR     │                │
│  │  & patterns        proposals     with docs     │                │
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

**Claude 根据上下文执行：**

1. **分析图片**（使用视觉能力）
   - 识别 UI 组件、布局、交互
   - 提取功能需求

2. **启动 `prd-planner`**

---

### 步骤 2: 创建 PRD

**Claude 调用 `prd-planner` 技能：**

```bash
# prd-planner 执行
Creating PRD using 4-file pattern...

✓ docs/data-refresh-prd-notes.md      # 思考过程
✓ docs/data-refresh-prd-task-plan.md  # 任务跟踪
✓ docs/data-refresh-prd.md            # 产品需求
✓ docs/data-refresh-tech.md           # 技术设计
```

**prd-planner 完成后可记录后续动作：**
```
→ self-improving-agent (background) - 记录学习提案
→ session-logger (auto) - 宿主支持时保存会话
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

### 捕获的候选经验
- 状态：candidate（尚未改变任何 skill）
- 候选 1：UI PRD 需要可验证的视觉规范
- 候选 2：成功标准需要可测量指标

### 下一步验证
- 用代表性 PRD 和 rubric 检查两条候选是否确实提高输出质量
- 验证通过后，只更新一个最窄的责任 skill
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

**Claude 调用 `code-reviewer`：**

```markdown
## Code Review 结果

### 发现的问题
1. ❌ 缺少加载状态
2. ✅ Props 类型定义正确

### 建议改进
- 添加 loading 状态显示
- 添加错误处理
```

**审核完成后可记录后续动作：**
```
→ self-improving-agent (background) - 记录审核模式提案
→ session-logger (auto) - 宿主支持时保存审核记录
```

---

### 步骤 6: 反馈与自我升级

**你：**
```
这次 PRD 写得不错，但 UI 规范还可以更详细
```

**Claude 调用 `self-improving-agent` 捕获候选：**

```bash
apb self-improve capture \
  --kind correction \
  --summary "PRD 中的 UI 规范需要可验证的尺寸、状态与相对位置" \
  --evidence "explicit-user-feedback"
```

这条经验先进入 candidate 队列。只有经过代表性检查并显式执行
`review --decision promote --validated` 后，才会进入 active rules；单次反馈
不会自动改写多个 skills。

---

### 步骤 7: 提交 PR

**你：**
```
提交代码
```

**Claude 调用 `commit-helper` → `create-pr`：**

```bash
# 1. 提交代码
git add RefreshActionButton.tsx RefreshActionButton.test.tsx
git commit -m "feat: add data refresh button with loading state"

# 2. 推送
git push -u origin feat/data-refresh

# 3. 创建 PR（检查中英文 README 是否需要同步）
✓ PR #15 created
```

**create-pr 完成后可记录后续动作：**
```
→ session-logger (auto) - 宿主支持时记录 PR 创建
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
      提取新的模式                                生成改进提案
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

[记录 self-improving-agent 后续动作，提取 PRD 模式提案]

═══════════════════════════════════════════════════════════════
你: 审核一下这个 PRD
═══════════════════════════════════════════════════════════════

Claude: [自我审核]

发现 2 个可改进点：
1. UI 规范可以更详细（按钮大小、间距）
2. 成功标准需要具体时间限制

已生成 prd-planner 检查项改进提案...

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

[记录 self-improving-agent 后续动作，提取审核模式提案]

═══════════════════════════════════════════════════════════════
你: 提交代码
═══════════════════════════════════════════════════════════════

Claude: [调用 create-pr]

✓ PR 已创建: https://github.com/.../pull/15
✓ README.md 和 README.zh-CN.md 已检查；需要时已同步更新
```

---

## 技能 Hook 后续动作关系

| 触发时机 | 后续动作 | 目的 |
|---------|---------------|------|
| prd-planner 完成 | self-improving-agent | 记录 PRD 模式提案 |
| prd-planner 完成 | session-logger | 宿主支持时保存会话 |
| code-reviewer 完成 | self-improving-agent | 提取代码质量模式提案 |
| 有价值的技能完成 | session-logger | 宿主支持时记录活动 |
| 用户要求提交 | create-pr | 创建 PR |

---

## 快速开始

### 最简流程

```
1. 发送图片/需求 → prd-planner 创建 PRD
2. 说"实现它" → 开始编码
3. 说"review" → code-reviewer 审核
4. 说"提交" → create-pr 提交 PR
```

### 完整流程（带反馈）

```
1. 发送需求 → 创建 PRD
2. 说"审核 PRD" → self-improving-agent 生成改进提案
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
