import { MemoryStore } from '../memory/store.js';
import { LLMClient, type Message } from '../llm/client.js';
import { Course } from '../curriculum/course.js';
import type { UserProfile, LearningRecord, ConversationHistory } from '../memory/types.js';

export interface TeachingPoint {
  concept: string;
  explanation: string;
  example: string;
  question: string;
}

export interface TeachingResponse {
  type: 'greeting' | 'teach' | 'question' | 'feedback' | 'praise' | 'correct' | 'incorrect' | 'continue';
  message: string;
  question?: string;
  options?: string[];
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

  constructor(store: MemoryStore, llm: LLMClient, course: Course) {
    this.store = store;
    this.llm = llm;
    this.course = course;
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

  // 开始/继续学习某个 lecture
  async teach(userId: string, lectureId: string): Promise<TeachingResponse> {
    const profile = this.store.getUserProfile(userId);
    const lecture = this.course.getLecture(lectureId);

    if (!lecture) {
      return {
        type: 'incorrect',
        message: `找不到课程: ${lectureId}`
      };
    }

    this.store.addConversation(userId, lectureId, 'assistant', `[开始学习: ${lecture.title}]`);

    const level = profile?.level || 'beginner';
    const language = profile?.preferredLanguage || 'python';

    const systemPrompt = `你是 AI 私教，教授"Harness 工程"——如何为 AI Agent 构建可靠执行环境的工程方法论。

教学生学"${lecture.title}"。用户${level}水平，用${language}。

重要：这个课程不是教 CI/CD 的，是教如何给 AI coding agent 配"马鞍"的。harness 是"模型权重之外的一切工程基础设施"。

规则：1. 每次只讲一个概念，简短 2. 用类比 3. 讲完问"能用自己的话说说吗"确认理解 4. 不给答案，引导思考`;

    const history = this.store.getConversationHistory(userId, lectureId);
    const messages: Message[] = [
      { role: 'system', content: systemPrompt }
    ];

    for (const msg of history) {
      messages.push({ role: msg.role, content: msg.content });
    }

    const response = await this.llm.generate(messages);
    this.store.addConversation(userId, lectureId, 'assistant', response);

    return {
      type: 'teach',
      message: response,
      teachingPoint: {
        concept: lecture.title,
        explanation: lecture.content,
        example: '',
        question: ''
      }
    };
  }

  // 处理用户的回应，进行三层验证
  async respond(userId: string, lectureId: string, userMessage: string): Promise<TeachingResponse> {
    const profile = this.store.getUserProfile(userId);
    const history = this.store.getConversationHistory(userId, lectureId);

    // 检查是否是第一轮（打招呼后的回应）
    const isFirstResponse = history.length <= 2;

    if (isFirstResponse) {
      // 用户说准备好了，开始讲第一个概念
      return this.teachNextConcept(userId, lectureId, userMessage);
    }

    // 检查用户是否在回答问题
    const lastAssistantMsg = history.filter(m => m.role === 'assistant').pop();

    if (lastAssistantMsg?.content.includes('用自己的话')) {
      // 第一层验证：理解检查
      return this.verifyUnderstanding(userId, lectureId, userMessage, '理解');
    }

    if (lastAssistantMsg?.content.includes('设计一个')) {
      // 第二层验证：应用检查
      return this.verifyUnderstanding(userId, lectureId, userMessage, '应用');
    }

    if (lastAssistantMsg?.content.includes('小练习') || lastAssistantMsg?.content.includes('写一段')) {
      // 第三层验证：微练习
      return this.verifyUnderstanding(userId, lectureId, userMessage, '练习');
    }

    // 继续对话
    return this.continueTeaching(userId, lectureId, userMessage);
  }

  // 讲下一个概念
  private async teachNextConcept(userId: string, lectureId: string, userMessage: string): Promise<TeachingResponse> {
    const profile = this.store.getUserProfile(userId);
    const lecture = this.course.getLecture(lectureId);

    this.store.addConversation(userId, lectureId, 'user', userMessage);

    // 先从课程内容中提取一个核心概念来讲
    const concept = lecture?.concepts[0] || 'Harness';

    const systemPrompt = `你是 AI 私教，教授"Harness 工程"——如何为 AI Agent 构建可靠执行环境的工程方法论。不是 CI/CD 平台。

风格：**先定义，再解释，最后给例子**。不要一直问问题。

格式：
1. 先给**定义**（一句话说清楚）
2. 再给**解释**（为什么重要）
3. 最后给**例子或类比**（让概念具体化）
4. 结尾问用户是否想深入或继续下一个概念

不要：
- 不要连珠炮式提问
- 不要"我想问"、"你的经验是"这种开场
- 不要只问问题不给答案`;

    const messages: Message[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `讲清楚这个概念：**${concept}**

课程标题：${lecture?.title}
课程内容摘要：${lecture?.content.substring(0, 500)}` }
    ];

    const response = await this.llm.generate(messages);
    this.store.addConversation(userId, lectureId, 'assistant', response);

    return {
      type: 'teach',
      message: response
    };
  }

  // 验证理解（三层）
  private async verifyUnderstanding(
    userId: string,
    lectureId: string,
    userMessage: string,
    type: '理解' | '应用' | '练习'
  ): Promise<TeachingResponse> {
    const profile = this.store.getUserProfile(userId);
    const lecture = this.course.getLecture(lectureId);

    this.store.addConversation(userId, lectureId, 'user', userMessage);

    // 判断用户回答是否正确/充分
    const evaluationPrompt = `你是 AI 私教，教授"Harness 工程"——如何为 AI Agent 构建可靠执行环境的工程方法论。不是 CI/CD 平台。

用户正在学习"${lecture?.title}"。
验证类型：${type}

用户回答：
${userMessage}

评估标准：
- 理解：是否抓住了核心概念（Harness 是模型之外的工程基础设施，不是 CI/CD）
- 应用：是否能迁移到实际场景
- 练习：是否能生成/写代码

回复格式：
如果答对了：先夸用户，然后继续下一个概念或问是否想深入
如果答错了：温和指出，轻微暗示，不要直接给答案，换个角度再解释

回复要简短，不超过 80 字。`;

    const response = await this.llm.generate([
      { role: 'system', content: evaluationPrompt }
    ]);

    // 判断是否理解（简化判断，实际可以用 LLM 判断）
    const understood = !response.includes('不太对') && !response.includes('有点偏差') && !response.includes('再想想');

    if (understood) {
      // 记录进步
      this.store.createOrUpdateLearningRecord(userId, lectureId);
    } else {
      // 记录薄弱点
      const lastQuestion = this.store.getConversationHistory(userId, lectureId)
        .filter(m => m.role === 'assistant')
        .pop();

      if (lastQuestion) {
        this.store.addWeakPoint(userId, lectureId, lastQuestion.content);
      }
    }

    this.store.addConversation(userId, lectureId, 'assistant', response);

    return {
      type: understood ? 'correct' : 'incorrect',
      message: response,
      understood
    };
  }

  // 继续对话式教学
  private async continueTeaching(userId: string, lectureId: string, userMessage: string): Promise<TeachingResponse> {
    const profile = this.store.getUserProfile(userId);
    const lecture = this.course.getLecture(lectureId);
    const history = this.store.getConversationHistory(userId, lectureId);

    this.store.addConversation(userId, lectureId, 'user', userMessage);

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
    // 简单的模式匹配，实际可以用 LLM 来提取
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
      // 检查是否有用户
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
      learningStreak: 0 // 后续实现
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
