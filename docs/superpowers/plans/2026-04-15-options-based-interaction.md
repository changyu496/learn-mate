# 实施计划：基于 Claude Code Teach-Me 的选项式交互

## 概述

将 LearnMate 从"硬编码关键词判断"重构为"选项式交互"，基于 Claude Code 的 teach-me skill 设计。

## 问题背景

### 原有流程的问题
```
用户自由输入 → 硬编码关键词判断（如"好"、"继续"） → 执行
```

**问题：**
1. "好，我们继续" 被误识别为开始学习
2. 内容输出太长（一屏显示不下）
3. 关键词判断不灵活，容易误判

### Teach-Me 模式的解决方案
```
展示选项 → 用户选择（数字或文字） → 意图明确 → 直接执行
```

**优势：**
1. 用户意图由选择决定，无需猜测
2. 选项帮助用户组织思考（scaffolding）
3. 符合 Claude Code 的最佳实践

## 实施内容

### 1. 新增 QuestionGenerator 类

**文件：** `src/agent/questionGenerator.ts`

```typescript
export class QuestionGenerator {
  // 生成概念列表选项
  generateConceptListOptions(lecture: LectureWithPoints): Promise<Question>

  // 生成概念介绍问题
  generateIntroduceQuestion(teachingPoint: TeachingPoint): Promise<Question>

  // 生成验证理解问题
  generateVerifyQuestion(teachingPoint: TeachingPoint, phase: TeachingPhase): Promise<Question>

  // 生成下一个概念选项
  generateNextConceptOptions(currentIndex: number, total: number): Promise<Question>
}
```

### 2. 重构 Learner 类

**文件：** `src/agent/learner.ts`

**新增方法：**
- `executeChoice(userId, choice)` - 执行用户选择

**修改方法：**
- `teach()` - 返回选项列表而非长文本
- `teachConcept()` - 展示概念介绍选项

**移除：**
- 硬编码的 `confirmPhrases` 关键词列表

### 3. 重构 CLI 交互

**文件：** `src/cli/index.ts`

**新增函数：**
- `displayOptions(options)` - 展示选项列表
- `parseChoice(input, options)` - 解析用户选择

**新增状态：**
- `inOptionsMode` - 是否在选项模式
- `currentOptions` - 当前选项列表

### 4. 增强 Session 持久化

**文件：** `src/memory/types.ts` 和 `src/memory/store.ts`

**新增 TeachingState：**
```typescript
interface TeachingState {
  lectureId: string;
  conceptIndex: number;
  phase: 'introduce' | 'verify' | 'practice' | 'mastery';
  lastQuestionType?: string;
}
```

**新增方法：**
- `setTeachingState(userId, state)`
- `getTeachingState(userId)`
- `clearTeachingState(userId)`

## 文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/agent/questionGenerator.ts` | 新增 | LLM 生成选项的类 |
| `src/agent/learner.ts` | 修改 | 重构教学方法，移除硬编码关键词 |
| `src/cli/index.ts` | 修改 | 支持选项模式展示和选择 |
| `src/memory/store.ts` | 修改 | 添加 TeachingState 持久化 |
| `src/memory/types.ts` | 修改 | 添加 TeachingState 类型 |
| `CLAUDE.md` | 修改 | 更新架构说明 |

## 验证方式

1. **编译验证：** `npm run build`
2. **单元测试：** `npx vitest run`
3. **手动测试：**
   ```
   npm run start
   > 你好，我想学 harness
   > ...
   > 准备好了吗？
   > 准备好了
   > ## 第一课：先搞清楚问题
   > 这节课包含 X 个概念：
   > 1. xxx
   > 2. xxx
   > 请选择：
   > 1
   ```

## 参考资料

- Claude Code teach-me skill: `.claude/skills/teach-me/SKILL.md`
- Pedagogy theory: `.claude/skills/teach-me/references/pedagogy.md`

## 状态

✅ 已完成
