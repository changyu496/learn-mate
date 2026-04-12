# LearnMate MVP 实现方案 (v2)

> **For agentic workers:** 使用 subagent-driven-development 执行

**目标：** 重构为对话式 AI 私教，不是课程执行器

**核心变化：**
- Agent 自己消化课程，用自己的话讲给用户
- 对话式学习，不是显示内容 + 出题
- 记住用户，个性化讲解

**验证体系：三层验证（理解 → 应用 → 微练习）**
- 第一层：理解检查（用自己的话复述）
- 第二层：应用检查（延伸问题）
- 第三层：微练习（生成任务）

---

## 重构任务

### Task R1: 重构 LLM Client（保持不变）

**文件：** `src/llm/client.ts`

已经是正确的，不需要改动。

---

### Task R2: 重构 Memory Store

**文件：** `src/memory/types.ts`, `src/memory/store.ts`

**新增用户画像类型：**
```typescript
export interface UserProfile {
  id: string;
  name: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  preferredLanguage: 'python' | 'java' | 'javascript' | 'go';
  learningStyle: 'slow' | 'fast' | 'deep' | 'practical';
  interests: string[];
  goals: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface LearningRecord {
  id: number;
  userId: string;
  lectureId: string;
  status: 'not_started' | 'in_progress' | 'mastered';
  attempts: number;
  weakPoints: string[];      // 薄弱点
 讲解偏好: string[];        // 用户喜欢的讲解方式
  lastReviewed: Date;
  masteredAt: Date | null;
}

export interface ConversationHistory {
  id: number;
  userId: string;
  lectureId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
}
```

**新增方法：**
- `updateUserProfile()` - 更新用户画像
- `getUserProfile()` - 获取用户画像
- `addWeakPoint()` - 添加薄弱点
- `saveConversation()` - 保存对话历史
- `getConversationHistory()` - 获取对话历史

---

### Task R3: 重构 Curriculum Parser

**文件：** `src/curriculum/parser.ts`, `src/curriculum/course.ts`

**变化：** 不需要大改，但需要新增一个方法：
```typescript
// 生成讲解要点（给 Agent 用，不是直接显示给用户）
async generateTeachingPoints(lectureId: string): Promise<TeachingPoint[]>

interface TeachingPoint {
  concept: string;          // 核心概念
  explanation: string;     // 通俗解释
  example: string;         // 例子
  question: string;        // 验证问题
}
```

---

### Task R4: 重构 Agent Learner（核心）

**文件：** `src/agent/learner.ts`

**完全重写：**

```typescript
export class Learner {
  // 入课对话 - 了解用户
  async onboarding(userId: string): Promise<string>

  // 开始学习某个 lecture
  async teach(userId: string, lectureId: string): Promise<TeachingResponse>

  // 处理用户回答
  async respond(
    userId: string,
    lectureId: string,
    userMessage: string
  ): Promise<TeachingResponse>

  // 检查用户是否真正理解了
  async checkUnderstanding(
    userId: string,
    lectureId: string,
    userAnswer: string
  ): Promise<{ understood: boolean; feedback: string }>

  // 获取学习进度
  async getProgress(userId: string): Promise<ProgressSummary>
}
```

**核心逻辑：**
1. Agent 消化课程内容，用自己的话讲
2. 每次只讲一个要点，然后问用户问题
3. 用户回答后，用三层验证判断：
   - 第一层：能用自己的话解释吗？
   - 第二层：能做延伸应用吗？
   - 第三层：能实际生成吗？
4. 没理解就从另一个角度再讲
5. 理解了才进入下一要点
6. 持续观察用户表现，动态调整节奏

---

### Task R5: 重构 CLI（对话式）

**文件：** `src/cli/index.ts`

**简化后的命令：**
```bash
learn-mate start     # 开始/继续对话
learn-mate progress # 查看进度
learn-mate reset    # 重置
```

**CLI 逻辑：**
```
1. 显示欢迎语
2. 检查用户是否有画像
   - 没有：进入 onboarding 对话
   - 有：进入学习对话
3. 学习循环：
   - Agent 讲一个要点
   - 用户回答/提问
   - Agent 响应
   - 直到本节完成
4. 进入下一节或结束
```

---

## 实现步骤

### Step 1: 更新类型定义

**文件：** `src/memory/types.ts`

```typescript
export interface UserProfile {
  id: string;
  name: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  preferredLanguage: 'python' | 'java' | 'javascript' | 'go';
  learningStyle: 'slow' | 'fast' | 'deep' | 'practical';
  interests: string[];
  goals: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface LearningRecord {
  id: number;
  userId: string;
  lectureId: string;
  status: 'not_started' | 'in_progress' | 'mastered';
  attempts: number;
  weakPoints: string[];
  讲解偏好: string[];
  lastReviewed: Date;
  masteredAt: Date | null;
}

export interface ConversationHistory {
  id: number;
  userId: string;
  lectureId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
}
```

### Step 2: 更新 MemoryStore

**文件：** `src/memory/store.ts`

新增表和方法的实现。

### Step 3: 重写 Learner

**文件：** `src/agent/learner.ts`

完全重写，使用对话式教学策略。

### Step 4: 重写 CLI

**文件：** `src/cli/index.ts`

对话式界面，移除 `plan set`、`answer` 等命令。

---

## 对话示例

```
用户: npm run start

私教: 👋 嗨！我是你的 AI 私教。
      听说你想学 harness？怎么想到学这个的？

用户: 感觉现在 AI 很火，想转行做 AI 应用开发

私教: 好目标！那你之前有编程经验吗？
      比如 Python、Java 这类？

用户: 做 Java 三年了

私教: 很好！Java 背景对理解 Agent 架构很有帮助。
      那你用过 LangChain 这类工具吗？

用户: 之前看过，但觉得有点迷糊

私教: 正常，很多人都有这种感觉。
      好，我们开始。先问你一个问题热身：
      如果你有一匹千里马，但没有马鞍和缰绳，能骑好吗？

用户: 估计挺难的

私教: 太对了！这就是 Harness 的核心。
      Harness 就是 Agent 的"马鞍和缰绳"——
      不是某个具体的东西，而是让你控制 LLM 的一切。
      模型再强，没有好的 Harness 也会出问题。

私教: 好了，你能用自己的话说说 Harness 是什么吗？

用户: 嗯...就是控制 LLM 的方法？包括给什么指令、用什么工具这些？

私教: ⭐ 非常准确！你抓住了核心。
      好，现在进阶一下：如果让你设计一个 Agent 的 Harness，
      你觉得应该包含哪些部分？

用户: 嗯...prompt 模板？然后工具定义？还有...记忆管理？

私教: ⭐ 太棒了！你已经有直觉了！
      来个小练习——用代码或文字描述，
      帮我写一段 prompt，让 LLM 扮演一个有工具的 Agent

[用户写出代码或描述]

私教: [评价用户的作品，给出反馈]
      好，你已经理解 Harness 的基础了。
      想继续深入，还是先休息一下？
```

---

## 验证标准

- [ ] 对话自然，不像在读文档
- [ ] Agent 能记住用户说过的话
- [ ] 不一次性给太多内容
- [ ] 答错时不直接给答案，而是继续引导
- [ ] 进度正确保存
