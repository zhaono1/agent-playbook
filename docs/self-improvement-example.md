# Self-Improving-Agent 学习示例

## 场景：用户报告一个 Bug

### 初始状态

```
用户：提交表单后数据没有刷新

Claude 使用 debugger skill 进行调试
```

---

## Step 1: 使用 Debugger Skill

```
┌─────────────────────────────────────────┐
│            Debugger 执行                 │
├─────────────────────────────────────────┤
│                                         │
│  1. 定位问题：检查数据刷新流程           │
│  2. 发现问题：onRefresh 回调是空的       │
│  3. 解决问题：添加实际刷新逻辑           │
│  4. 验证修复：测试确认数据正常刷新       │
│                                         │
└─────────────────────────────────────────┘
```

---

## Step 2: 记录 Self-Improving-Agent 后续动作

```
Debugger Complete
        ↓
workflow-orchestrator 检测到完成
        ↓
self-improving-agent (后台提案，宿主支持时运行)
```

---

## Step 3: 提取经验

### Episodic Memory（情景记忆）

```json
{
  "episode_id": "ep-2025-01-11-001",
  "timestamp": "2025-01-11T15:30:00Z",
  "skill_used": "debugger",
  "situation": "表单提交后数据没有刷新",
  "root_cause": "onRefresh 回调函数是空函数: () => {}",
  "solution": "实现实际刷新逻辑：调用 fetchReserves()",
  "user_feedback": "positive",
  "repetition": 1  // 第 1 次遇到
}
```

---

## Step 4: 抽象模式

### 从具体经验到通用模式

| 具体经验 | 抽象模式 | 目标技能 |
|---------|---------|---------|
| "onRefresh 是空函数导致不刷新" | "验证回调函数必须有实际实现" | debugger, prd-implementation-precheck |
| "用户传空函数但期望有行为" | "在接收回调时验证其有效性" | 所有涉及回调的技能 |

### Semantic Memory（语义记忆）

```json
{
  "patterns": {
    "callback_verification": {
      "pattern": "接收回调函数作为参数时，必须验证回调不是空函数且包含实际逻辑",
      "trigger": "任何涉及 props 回调的场景",
      "check_method": "检查回调体是否为空或只有 return",
      "confidence": 0.5,  // 初始置信度
      "applications": 1,
      "source_episodes": ["ep-2025-01-11-001"],
      "target_skills": ["debugger", "prd-implementation-precheck", "code-reviewer"]
    }
  }
}
```

---

## Step 5: 生成相关技能改进提案

### 更新 debugger/SKILL.md

```markdown
---

## Proposed Update (from self-improving-agent)

### Pattern Added (2025-01-11)

**Callback Verification Pattern**

**Problem**: Empty callback functions don't execute any logic, causing silent failures.

**Solution**: Always verify that callbacks contain actual implementation, not just `() => {}` or `() => { return }`.

**Check Method**:
- Read callback function body
- Verify it has meaningful statements
- Test callback execution path

**Source**: Episode ep-2025-01-11-001
**Confidence**: 0.5 (needs more validation)
**Occurrences**: 1/1

### Pre-Flight Checklist (Updated)

When debugging UI refresh issues:
- [x] Check callback functions are not empty
- [ ] Verify callback is actually being called
- [ ] Check data flow through callback
```

### 更新 prd-implementation-precheck/SKILL.md

```markdown
---

## Proposed Update (from self-improving-agent)

### Pattern Added (2025-01-11)

**Callback Verification**

When reviewing PRDs that specify callback props:
- Flag callbacks that might be empty
- Require specification of callback behavior
- Add to dependencies: "Callback implementation required"

**Source**: Episode ep-2025-01-11-001 (debugger experience)
**Confidence**: 0.5
```

### 更新 code-reviewer/SKILL.md

```markdown
---

## Proposed Update (from self-improving-agent)

### Pattern Added (2025-01-11)

**Review Item: Empty Callbacks**

Check for:
```typescript
// Bad - empty callback
onRefresh={() => {}}

// Good - actual implementation
onRefresh={() => { fetchReserves(); }}
```

**Risk**: Silent failures, undefined behavior
**Action**: Flag in code review comments

**Source**: Episode ep-2025-01-11-001
**Confidence**: 0.5
```

---

## Step 6: 生成改进报告

### 给用户的反馈

```markdown
## 🧠 Self-Improvement Summary

I've learned from this debugging session and created the following proposals:

### Pattern Extracted
**Callback Verification**: Always verify callback functions contain actual logic,
not empty implementations.

### Proposed Skill Updates
- `debugger` - Add callback verification to checklist
- `prd-implementation-precheck` - Add callback requirement check
- `code-reviewer` - Add empty callback detection

### Confidence Level
⭐⭐☆☆☆ (0.5) - First occurrence, needs validation

### Help Me Learn
Was this pattern correctly identified?
- [ ] Yes, this is a common issue
- [ ] No, the situation was unique
- [ ] Partially, needs refinement

Your feedback helps me improve faster!
```

---

## Step 7: 下次遇到类似问题

### 场景：用户再次遇到回调问题

```
用户：点击按钮后什么都没发生

Claude (已学习):
→ 检测到是按钮点击回调问题
→ 立即检查：onClick 是不是空函数？
→ 发现：是的！onClick={() => {}}
→ 快速定位：回调为空导致
→ 解决：添加实际逻辑
```

### 效率对比

| 指标 | 第一次学习前 | 学习后（第2次） |
|------|-------------|----------------|
| 定位时间 | 15 分钟 | 2 分钟 |
| 尝试次数 | 5 次 | 1 次 |
| 准确率 | 60% | 95% |

---

## 模式成熟过程

```
第1次遇到：提取模式 → confidence = 0.5
第2次遇到：确认模式 → confidence = 0.7
第3次遇到：强化模式 → confidence = 0.85
第4次遇到：模式成熟 → confidence = 0.95
第5+次：成为最佳实践 → confidence = 1.0
```

---

## 完整学习循环可视化

```
┌─────────────────────────────────────────────────────────────────┐
│                     完整的自我进化循环                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  用户问题 → Debugger 解决 → 提取经验 → 抽象模式                  │
│     │           │              │            │                   │
│     │           │              │            ↓                   │
│     │           │              │    提出 3 个技能改进            │
│     │           │              │            │                   │
│     │           │              │            ↓                   │
│     │           │              │    保存到记忆                   │
│     │           │              │            │                   │
│     │           │              └────────────┤                   │
│     │           │                           ↓                   │
│     │           └────────────────→ 下次更快解决                 │
│     │                                               │           │
│     └───────────────────────────────────────────┘           │
│                  每次验证后沉淀更可靠的方法                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 关键要点

1. **后续动作** - 技能完成后可记录学习提案，是否运行取决于宿主支持
2. **多技能提案** - 一个经验可以提出多个相关技能的改进
3. **置信度追踪** - 随着验证次数增加，模式更可靠
4. **人类反馈** - 用户反馈帮助校准学习方向
5. **持续改进** - 经过验证的模式再推广到 durable guidance
