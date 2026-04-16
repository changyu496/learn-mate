import type { TeachingPoint, LectureWithPoints } from '../curriculum/parser.js';
import type { Message } from '../llm/client.js';
import { LLMClient } from '../llm/client.js';

// Re-export TeachingPoint for use in Learner
export type { TeachingPoint };

export interface QuestionOption {
  label: string;      // 选项标签
  description: string; // 选项描述
  value: string;      // 选项值（内部使用）
}

export interface Question {
  question: string;     // 问题文本
  header: string;       // 简短标题
  options: QuestionOption[];
  multiSelect?: boolean;
}

export type TeachingPhase = 'introduce' | 'verify' | 'practice' | 'mastery';

export class QuestionGenerator {
  private llm: LLMClient;

  constructor(llm: LLMClient) {
    this.llm = llm;
  }

  /**
   * 生成概念列表选项
   * 让用户选择要学习哪个概念
   */
  async generateConceptListOptions(lecture: LectureWithPoints): Promise<Question> {
    const conceptList = lecture.teachingPoints
      .map((tp, i) => `${i + 1}. ${tp.concept}：${tp.explanation.substring(0, 50)}...`)
      .join('\n');

    const messages: Message[] = [
      {
        role: 'system',
        content: `你是 AI 私教，擅长设计多选题选项。

设计原则：
1. 选项要简洁明确（1-5 个字）
2. 每个选项描述要清楚（1 句话）
3. 选项之间要互斥
4. 包含一个"其他"选项让用户自由输入

请生成概念列表选择选项：`
      },
      {
        role: 'user',
        content: `课程：${lecture.title}
概念列表：
${conceptList}

请生成选项：
- 选项 1-N：让用户选择第几个概念学习
- 选项：我想问一个问题
- 选项：继续当前对话

请以 JSON 格式返回：
{
  "options": [
    {"label": "概念1：xxx", "description": "描述", "value": "concept:1"},
    ...
  ]
}`
      }
    ];

    const response = await this.llm.generate(messages);
    return this.parseQuestionResponse(response, 'select');
  }

  /**
   * 生成概念介绍问题
   * 基于 Claude Code teach-me 的设计：
   * - 先给 1-2 句话介绍
   * - 然后问一个选择题帮助用户思考
   */
  async generateIntroduceQuestion(teachingPoint: TeachingPoint, userName?: string): Promise<Question> {
    const messages: Message[] = [
      {
        role: 'system',
        content: `你是 AI 私教，教授"Harness 工程"。

风格：简洁友好，像朋友聊天。**先定义，再解释，最后给例子**。

根据 Claude Code teach-me 的设计原则：
- 选项是思考的 scaffolds，不是限制
- 选项要帮助用户组织思考
- 包含正确选项、误解干扰项、"我不确定"选项
- 每个选项要有 description 提供 hint

设计问题选项：
1. 1-2 个正确/部分正确的选项
2. 1 个基于常见误解的干扰项
3. 1 个"我不确定"选项

选项格式：
- label: 简短选项文本
- description: 选项解释或 hint
- value: 内部使用的值`
      },
      {
        role: 'user',
        content: `概念：${teachingPoint.concept}
定义：${teachingPoint.explanation}

请为这个概念设计一个介绍问题，帮助用户理解。

请以 JSON 格式返回：
{
  "question": "问题文本",
  "header": "理解",
  "options": [
    {"label": "选项1", "description": "描述", "value": "correct:1"},
    {"label": "选项2", "description": "描述", "value": "correct:2"},
    {"label": "选项3（误解）", "description": "描述", "value": "misconception"},
    {"label": "我不确定", "description": "没关系，我们一起探索", "value": "unsure"}
  ]
}`
      }
    ];

    const response = await this.llm.generate(messages);
    return this.parseQuestionResponse(response, 'introduce');
  }

  /**
   * 生成验证理解问题
   * 三层验证：理解 → 应用 → 练习
   */
  async generateVerifyQuestion(
    teachingPoint: TeachingPoint,
    phase: TeachingPhase,
    userAnswer?: string
  ): Promise<Question> {
    const phaseConfig = {
      introduce: {
        header: '理解检查',
        question: `你能用自己的话说说"${teachingPoint.concept}"是什么意思吗？`
      },
      verify: {
        header: '应用检查',
        question: `如果让你在实际场景中使用"${teachingPoint.concept}"，你会怎么做？`
      },
      practice: {
        header: '练习',
        question: `写一段代码或描述，展示"${teachingPoint.concept}"的应用`
      },
      mastery: {
        header: '掌握确认',
        question: `现在你能解释清楚"${teachingPoint.concept}"，并用它解决一个新问题吗？`
      }
    };

    const config = phaseConfig[phase];

    const messages: Message[] = [
      {
        role: 'system',
        content: `你是 AI 私教，教授"Harness 工程"。

根据 Claude Code teach-me 设计：
- 选项帮助用户组织思考
- 包含正确选项、误解干扰项、"我不确定"选项
- 选项的 description 要提供 hint

设计验证问题选项。`
      },
      {
        role: 'user',
        content: `概念：${teachingPoint.concept}
定义：${teachingPoint.explanation}
验证阶段：${phase}
问题：${config.question}
${userAnswer ? `用户回答：${userAnswer}` : ''}

请以 JSON 格式返回：
{
  "question": "问题文本",
  "header": "${config.header}",
  "options": [
    {"label": "选项1", "description": "描述", "value": "correct"},
    {"label": "选项2", "description": "描述", "value": "partial"},
    {"label": "选项3（误解）", "description": "描述", "value": "incorrect"},
    {"label": "我不确定", "description": "描述", "value": "unsure"}
  ]
}`
      }
    ];

    const response = await this.llm.generate(messages);
    return this.parseQuestionResponse(response, phase);
  }

  /**
   * 生成下一个概念选项
   */
  async generateNextConceptOptions(
    currentIndex: number,
    totalConcepts: number,
    remainingConcepts: TeachingPoint[]
  ): Promise<Question> {
    const options: QuestionOption[] = [];

    // 如果还有下一个概念，提供继续选项
    if (currentIndex < totalConcepts - 1) {
      const nextConcept = remainingConcepts[0];
      options.push({
        label: `下一个：${nextConcept.concept}`,
        description: '继续学习下一个概念',
        value: 'next'
      });
    }

    // 提供回顾选项
    options.push({
      label: '我想回顾一下刚才学的',
      description: '复习已学内容',
      value: 'review'
    });

    // 提供提问选项
    options.push({
      label: '我有问题想问',
      description: '关于当前概念的疑问',
      value: 'ask'
    });

    // 提供结束选项
    options.push({
      label: '休息一下',
      description: '下次继续学习',
      value: 'exit'
    });

    return {
      question: '你想怎么做？',
      header: '选择',
      options,
      multiSelect: false
    };
  }

  /**
   * 解析 LLM 返回的 JSON 问题
   */
  private parseQuestionResponse(response: string, type: string): Question {
    try {
      // 尝试提取 JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);

        // 验证必需字段
        if (parsed.options && Array.isArray(parsed.options)) {
          return {
            question: parsed.question || '请选择：',
            header: parsed.header || '选择',
            options: parsed.options.map((opt: { label: string; description?: string; value?: string }, i: number) => ({
              label: opt.label || `选项 ${i + 1}`,
              description: opt.description || '',
              value: opt.value || `option:${i}`
            })),
            multiSelect: parsed.multiSelect || false
          };
        }
      }
    } catch {
      // JSON 解析失败，使用默认选项
    }

    // 返回默认选项（降级方案）
    return this.getDefaultQuestion(type);
  }

  /**
   * 获取默认问题（当 LLM 调用失败时）
   */
  private getDefaultQuestion(type: string): Question {
    if (type === 'select') {
      return {
        question: '请选择：',
        header: '选择',
        options: [
          { label: '第一个概念', description: '从头开始学习', value: 'concept:0' },
          { label: '我想问问题', description: '关于课程的疑问', value: 'ask' },
          { label: '继续对话', description: '继续当前话题', value: 'continue' }
        ],
        multiSelect: false
      };
    }

    return {
      question: '你的理解是？',
      header: '理解',
      options: [
        { label: '我理解了', description: '概念已经清楚', value: 'correct' },
        { label: '部分理解', description: '还有一些疑问', value: 'partial' },
        { label: '不太懂', description: '需要更多解释', value: 'unsure' }
      ],
      multiSelect: false
    };
  }
}
