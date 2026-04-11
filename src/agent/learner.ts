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

    if (profile) {
      // 有画像，友好打招呼，继续学习
      return {
        type: 'greeting',
        message: `${profile.name}，欢迎回来！上次我们学到...`
      };
    }

    // 没有画像，开始入课对话
    const messages: Message[] = [
      {
        role: 'system',
        content: `你是一个温暖、专业的 AI 私教。你正在了解一个新用户，准备为他定制学习体验。
你的风格：友好、鼓励、像朋友聊天一样。
你现在要通过轻松的对话了解用户：1. 名字 2. 背景/经验 3. 学习目标
不要一次问太多问题，让对话自然流畅。`
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
    // 获取对话历史
    const history = this.store.getConversationHistory(userId, 'onboarding');

    // 构建消息
    const messages: Message[] = [
      {
        role: 'system',
        content: `你是一个温暖、专业的 AI 私教，正在通过对话了解用户。
当用户告诉你他的信息时，记得更新用户画像。
收集到以下信息后结束 onboarding：
- 名字（如果有）
- 编程经验
- 是否用过 Agent 工具（LangChain 等）
- 学习目标

对话结束后说"好的，我记住了"，并简单总结你了解到的用户信息。`
      }
    ];

    // 添加历史对话
    for (const msg of history) {
      messages.push({
        role: msg.role,
        content: msg.content
      });
    }

    messages.push({ role: 'user', content: userMessage });

    const response = await this.llm.generate(messages);

    // 保存对话
    this.store.addConversation(userId, 'onboarding', 'user', userMessage);
    this.store.addConversation(userId, 'onboarding', 'assistant', response);

    // 尝试从对话中提取用户信息并更新画像
    await this.updateProfileFromConversation(userId, userMessage, response);

    // 检查是否需要继续 onboarding
    const profile = this.store.getUserProfile(userId);
    if (profile && profile.goals) {
      // 画像已建立，开始学习
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

    // 保存当前 lecture
    this.store.addConversation(userId, lectureId, 'assistant', `[开始学习: ${lecture.title}]`);

    // 构建教学 prompt
    const teachingStyle = profile?.teachingStyle || 'friendly';
    const level = profile?.level || 'beginner';
    const language = profile?.preferredLanguage || 'python';

    const systemPrompt = `你是一个专业的 AI 私教，正在教用户学习"${lecture.title}"。
你的风格：${teachingStyle === 'serious' ? '严谨认真' : teachingStyle === 'encouraging' ? '温暖鼓励' : '轻松友好'}
用户背景：${level}水平，偏好的语言：${language}

教学原则：
1. 不要一次性讲太多，每次只讲一个核心概念
2. 用用户能理解的类比和例子解释
3. 讲完一个概念后，问用户问题确认理解
4. 不要直接给答案，引导用户自己思考
5. 如果用户答错了，换个角度再解释

开始教学，先简单介绍这个 lecture 要讲什么，然后问用户准备好了吗。`;

    const history = this.store.getConversationHistory(userId, lectureId);
    const messages: Message[] = [
      { role: 'system', content: systemPrompt }
    ];

    // 添加历史
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

    const systemPrompt = `用户说"准备好了"或类似的话。
现在你要讲第一个核心概念。
规则：
1. 只讲一个概念，用简短的话（不超过 100 字）
2. 用类比或例子
3. 讲完后问用户问题确认理解，格式如："你能用自己的话说说 XXX 是什么意思吗？"
4. 不要一次讲多个概念`;

    const messages: Message[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `课程是：${lecture?.title}\n概念：${lecture?.concepts.join(', ')}\n用户说：${userMessage}` }
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
    const evaluationPrompt = `用户正在学习"${lecture?.title}"。
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

    const systemPrompt = `你是一个专业的 AI 私教，正在教用户学习"${lecture?.title}"。
用户正在跟你对话。

规则：
1. 根据用户的回应继续引导
2. 不要一次给太多信息
3. 用户有问题就回答，有困惑就解释
4. 适时问问题确认理解
5. 用户答对时给予肯定
6. 对话要自然，像朋友聊天`;

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
