import { MemoryStore } from '../memory/store.js';
import { LLMClient, type Message } from '../llm/client.js';
import { Course } from '../curriculum/course.js';
import type { UserProfile, LearningRecord } from '../memory/types.js';
import type { LectureWithPoints } from '../curriculum/parser.js';
import { QuestionGenerator, type QuestionOption, type TeachingPoint } from './questionGenerator.js';

export type { TeachingPoint };

export interface TeachingResponse {
  type: 'greeting' | 'teach' | 'question' | 'feedback' | 'praise' | 'correct' | 'incorrect' | 'continue' | 'options';
  message: string;
  question?: string;
  options?: QuestionOption[];  // 选项式响应
  teachingPoint?: TeachingPoint;
  understood?: boolean;
}

export interface ProgressSummary {
  completed: number;
  total: number;
  currentLecture: string | null;
  weakPoints: string[];
  learningStreak: number;
}

export class Learner {
  private store: MemoryStore;
  private llm: LLMClient;
  private course: Course;
  private questionGenerator: QuestionGenerator;

  constructor(store: MemoryStore, llm: LLMClient, course: Course) {
    this.store = store;
    this.llm = llm;
    this.course = course;
    this.questionGenerator = new QuestionGenerator(llm);
  }

  // 入课对话 - 了解用户，建立画像
  async startConversation(userId: string): Promise<TeachingResponse> {
    // 检查是否有用户画像
    const profile = this.store.getUserProfile(userId);
    const history = this.store.getConversationHistory(userId, 'onboarding');

    if (profile && history.length > 0) {
      // 有用户画像和对话历史，说明是老用户
      return {
        type: 'greeting',
        message: `${profile.name}，欢迎回来！继续学习吗？`
      };
    }

    // 没有画像，开始入课对话
    const messages: Message[] = [
      {
        role: 'system',
        content: `你是学生的 AI 私教，教授"Harness 工程"——这是关于如何为 AI Agent 构建可靠执行环境的工程方法论，不是 CI/CD 平台。

风格友好自然，像朋友聊天。问学生：名字、背景、学习目标。不要一次问太多问题。

重要：这个课程教的是如何给 AI coding agent 配"马鞍"（harness），包括指令设计、工具配置、状态管理、验证反馈等工程实践。`
      },
      {
        role: 'user',
        content: '你好，我想学习 harness 工程'
      }
    ];

    const response = await this.llm.generate(messages);

    return {
      type: 'greeting',
      message: response
    };
  }

  // 处理用户回复，收集信息直到画像建立完成
  async continueOnboarding(userId: string, userMessage: string): Promise<TeachingResponse> {
    const history = this.store.getConversationHistory(userId, 'onboarding');

    const messages: Message[] = [
      {
        role: 'system',
        content: `你是 AI 私教，教授"Harness 工程"——如何为 AI Agent 构建可靠执行环境的工程方法论。

通过对话了解学生信息：名字、经验、目标。回复简洁自然。收集完信息后说"好的，我记住了"并总结。

重要：这个课程不是教 CI/CD 的，是教如何给 AI coding agent 配"马鞍"的。`
      }
    ];

    for (const msg of history) {
      messages.push({ role: msg.role, content: msg.content });
    }
    messages.push({ role: 'user', content: userMessage });

    const response = await this.llm.generate(messages);

    this.store.addConversation(userId, 'onboarding', 'user', userMessage);
    this.store.addConversation(userId, 'onboarding', 'assistant', response);
    await this.updateProfileFromConversation(userId, userMessage, response);

    const profile = this.store.getUserProfile(userId);
    if (profile && profile.goals) {
      return {
        type: 'continue',
        message: response + '\n\n准备好了吗？我们开始学习！'
      };
    }

    return {
      type: 'question',
      message: response
    };
  }

  // 开始/继续学习某个 lecture - 展示概念列表选项
  async teach(userId: string, lectureId: string): Promise<TeachingResponse> {
    const profile = this.store.getUserProfile(userId);
    const lectureWithPoints = await this.course.getLectureWithTeachingPoints(lectureId);

    if (!lectureWithPoints) {
      return {
        type: 'incorrect',
        message: `找不到课程: ${lectureId}`
      };
    }

    this.store.addConversation(userId, lectureId, 'assistant', `[开始学习: ${lectureWithPoints.title}]`);

    // 生成概念列表选项
    const question = await this.questionGenerator.generateConceptListOptions(lectureWithPoints);

    // 保存当前教学状态
    this.store.setTeachingState(userId, {
      lectureId,
      conceptIndex: 0,
      phase: 'introduce'
    });

    return {
      type: 'options',
      message: `## ${lectureWithPoints.title}\n\n${(lectureWithPoints.narrative || '').split('\n')[0] || ''}\n\n这节课包含 ${lectureWithPoints.teachingPoints.length} 个概念，请选择一个开始学习：`,
      options: question.options,
      teachingPoint: lectureWithPoints.teachingPoints[0]
    };
  }

  // 执行用户选择 - 核心方法，根据选项值执行对应动作
  async executeChoice(userId: string, choice: string): Promise<TeachingResponse> {
    const state = this.store.getTeachingState(userId);
    if (!state) {
      return {
        type: 'incorrect',
        message: '教学状态丢失，请重新开始'
      };
    }

    // 解析选择值
    if (choice.startsWith('concept:')) {
      // 用户选择学习某个概念
      const index = parseInt(choice.split(':')[1], 10);
      return this.teachConcept(userId, state.lectureId, index);
    }

    if (choice === 'next') {
      // 继续下一个概念
      return this.teachNextConcept(userId, state.lectureId, state.conceptIndex);
    }

    if (choice === 'review') {
      // 回顾当前概念
      return this.teachConcept(userId, state.lectureId, state.conceptIndex);
    }

    if (choice === 'ask') {
      // 用户想提问
      return this.continueTeaching(userId, state.lectureId, '');
    }

    if (choice === 'continue') {
      // 继续对话
      return this.continueTeaching(userId, state.lectureId, '');
    }

    if (choice === 'exit') {
      // 退出学习
      return {
        type: 'continue',
        message: '好的，下次继续！'
      };
    }

    // 默认继续对话
    return this.continueTeaching(userId, state.lectureId, choice);
  }

  // 讲某个概念
  async teachConcept(userId: string, lectureId: string, conceptIndex: number): Promise<TeachingResponse> {
    const profile = this.store.getUserProfile(userId);
    const lectureWithPoints = await this.course.getLectureWithTeachingPoints(lectureId);

    if (!lectureWithPoints) {
      return {
        type: 'incorrect',
        message: `找不到课程: ${lectureId}`
      };
    }

    if (conceptIndex >= lectureWithPoints.teachingPoints.length) {
      conceptIndex = 0;
    }

    const teachingPoint = lectureWithPoints.teachingPoints[conceptIndex];

    // 保存当前教学状态
    this.store.setTeachingState(userId, {
      lectureId,
      conceptIndex,
      phase: 'introduce'
    });

    // 生成介绍问题（选项式）
    const question = await this.questionGenerator.generateIntroduceQuestion(
      teachingPoint,
      profile?.name
    );

    const total = lectureWithPoints.teachingPoints.length;
    const remaining = total - conceptIndex - 1;

    return {
      type: 'options',
      message: `## 概念 ${conceptIndex + 1}/${total}：${teachingPoint.concept}\n\n${teachingPoint.explanation}${remaining > 0 ? `\n\n（共 ${total} 个概念，还剩 ${remaining} 个）` : '\n\n（最后一个概念 🎉）'}`,
      options: question.options,
      teachingPoint
    };
  }

  // 讲下一个概念
  async teachNextConcept(userId: string, lectureId: string, currentIndex: number): Promise<TeachingResponse> {
    const lectureWithPoints = await this.course.getLectureWithTeachingPoints(lectureId);

    if (!lectureWithPoints) {
      return {
        type: 'incorrect',
        message: `找不到课程: ${lectureId}`
      };
    }

    const nextIndex = currentIndex + 1;
    if (nextIndex >= lectureWithPoints.teachingPoints.length) {
      // 已经讲完所有概念
      return {
        type: 'teach',
        message: '🎉 这节课的所有概念都学完了！\n\n你可以：\n- 说"继续下一课"学习下一节\n- 说"我想回顾"复习刚才学的\n- 或者问我任何问题'
      };
    }

    return this.teachConcept(userId, lectureId, nextIndex);
  }

  // 处理用户的回应
  async respond(userId: string, lectureId: string, userMessage: string): Promise<TeachingResponse> {
    const history = this.store.getConversationHistory(userId, lectureId);

    // 检查是否在回答验证问题
    const lastAssistantMsg = history.filter(m => m.role === 'assistant').pop();

    if (lastAssistantMsg?.content.includes('用自己的话')) {
      return this.verifyUnderstanding(userId, lectureId, userMessage, '理解');
    }

    if (lastAssistantMsg?.content.includes('设计一个')) {
      return this.verifyUnderstanding(userId, lectureId, userMessage, '应用');
    }

    if (lastAssistantMsg?.content.includes('小练习') || lastAssistantMsg?.content.includes('写一段')) {
      return this.verifyUnderstanding(userId, lectureId, userMessage, '练习');
    }

    // 继续对话
    return this.continueTeaching(userId, lectureId, userMessage);
  }

  // 验证理解（三层）
  private async verifyUnderstanding(
    userId: string,
    lectureId: string,
    userMessage: string,
    type: '理解' | '应用' | '练习'
  ): Promise<TeachingResponse> {
    const state = this.store.getTeachingState(userId);
    const lectureWithPoints = await this.course.getLectureWithTeachingPoints(lectureId);

    this.store.addConversation(userId, lectureId, 'user', userMessage);

    if (!lectureWithPoints || !state) {
      return {
        type: 'incorrect',
        message: '状态丢失'
      };
    }

    const teachingPoint = lectureWithPoints.teachingPoints[state.conceptIndex];

    // 判断用户回答是否正确/充分
    const evaluationPrompt = `你是 AI 私教，教授"Harness 工程"——如何为 AI Agent 构建可靠执行环境的工程方法论。不是 CI/CD 平台。

用户正在学习"${lectureWithPoints.title}" - "${teachingPoint.concept}"
验证类型：${type}

用户回答：
${userMessage}

评估标准：
- 理解：是否抓住了核心概念
- 应用：是否能迁移到实际场景
- 练习：是否能生成/写代码

回复格式：
如果答对了：先夸用户，然后继续下一个概念或问是否想深入
如果答错了：温和指出，轻微暗示，不要直接给答案，换个角度再解释

回复要简短，不超过 80 字。`;

    const response = await this.llm.generate([
      { role: 'system', content: evaluationPrompt }
    ]);

    // 判断是否理解（简化判断）
    const understood = !response.includes('不太对') && !response.includes('有点偏差') && !response.includes('再想想');

    if (understood) {
      this.store.createOrUpdateLearningRecord(userId, lectureId);
    } else {
      const lastQuestion = this.store.getConversationHistory(userId, lectureId)
        .filter(m => m.role === 'assistant')
        .pop();

      if (lastQuestion) {
        this.store.addWeakPoint(userId, lectureId, lastQuestion.content);
      }
    }

    this.store.addConversation(userId, lectureId, 'assistant', response);

    // 生成下一个选项
    const nextQuestion = await this.questionGenerator.generateNextConceptOptions(
      state.conceptIndex,
      lectureWithPoints.teachingPoints.length,
      lectureWithPoints.teachingPoints.slice(state.conceptIndex + 1)
    );

    return {
      type: understood ? 'correct' : 'incorrect',
      message: response,
      options: nextQuestion.options,
      understood
    };
  }

  // 继续对话式教学
  private async continueTeaching(userId: string, lectureId: string, userMessage: string): Promise<TeachingResponse> {
    const profile = this.store.getUserProfile(userId);
    const lecture = this.course.getLecture(lectureId);
    const history = this.store.getConversationHistory(userId, lectureId);

    if (userMessage) {
      this.store.addConversation(userId, lectureId, 'user', userMessage);
    }

    const systemPrompt = `你是 AI 私教，教授"Harness 工程"——如何为 AI Agent 构建可靠执行环境的工程方法论。不是 CI/CD 平台。

正在教用户学习"${lecture?.title}"。

原则：**先教后问**。用户问什么，就先回答什么（给清晰答案），然后适当延伸。

规则：
1. 用户问什么 → 先直接回答
2. 回答后可以延伸："顺便说一下，这个还涉及到..."
3. 不要反问太多次
4. 不要一直追问用户"你怎么看"
5. 对话要像老师授课，不是苏格拉底式追问`;

    const messages: Message[] = [
      { role: 'system', content: systemPrompt }
    ];

    for (const msg of history) {
      messages.push({ role: msg.role, content: msg.content });
    }

    const response = await this.llm.generate(messages);
    this.store.addConversation(userId, lectureId, 'assistant', response);

    return {
      type: 'question',
      message: response
    };
  }

  // 从对话中更新用户画像
  private async updateProfileFromConversation(userId: string, userMessage: string, assistantResponse: string): Promise<void> {
    const nameMatch = userMessage.match(/我叫(.+?)[，,]|\s名字是(.+?)[，,]/);
    const languageMatch = userMessage.match(/java|python|javascript|go/i);
    const levelMatch = userMessage.match(/一年|两年|三年|新手|有经验|初学者/i);
    const goalsMatch = userMessage.match(/想学|目标是|为了|转行|工作|学习/i);

    const updates: Partial<UserProfile> = {};

    if (nameMatch) {
      updates.name = nameMatch[1] || nameMatch[2];
    }
    if (languageMatch) {
      const lang = languageMatch[0].toLowerCase();
      if (lang.includes('java')) updates.preferredLanguage = 'java';
      else if (lang.includes('python')) updates.preferredLanguage = 'python';
      else if (lang.includes('javascript')) updates.preferredLanguage = 'javascript';
      else if (lang.includes('go')) updates.preferredLanguage = 'go';
    }
    if (levelMatch) {
      if (levelMatch[0].includes('新手') || levelMatch[0].includes('初学者')) {
        updates.level = 'beginner';
      } else {
        updates.level = 'intermediate';
      }
    }
    if (goalsMatch) {
      updates.goals = userMessage;
    }

    if (Object.keys(updates).length > 0) {
      let profile = this.store.getUserProfile(userId);
      if (!profile) {
        this.store.createUserProfile(userId, 'Learner');
        profile = this.store.getUserProfile(userId);
      }
      if (profile) {
        this.store.updateUserProfile(userId, updates);
      }
    }
  }

  // 获取进度
  async getProgress(userId: string): Promise<ProgressSummary> {
    const records = this.store.getAllLearningRecords(userId);
    const completed = records.filter(r => r.status === 'mastered').length;
    const total = this.course.getTotalLectures();
    const currentLecture = this.store.getLatestLecture(userId);

    const weakPoints = records
      .flatMap(r => r.weakPoints)
      .filter((v, i, a) => a.indexOf(v) === i);

    return {
      completed,
      total,
      currentLecture,
      weakPoints,
      learningStreak: 0
    };
  }

  // 获取下一个 lecture
  async getNextLecture(userId: string): Promise<string | null> {
    const records = this.store.getAllLearningRecords(userId);
    const masteredIds = records
      .filter(r => r.status === 'mastered')
      .map(r => r.lectureId);

    const lectures = this.course.getLectures();

    for (const lecture of lectures) {
      if (!masteredIds.includes(lecture.id)) {
        return lecture.id;
      }
    }

    return null;
  }
}
