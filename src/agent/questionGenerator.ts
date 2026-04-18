import type { TeachingPoint, LectureWithPoints } from '../curriculum/parser.js';

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

/**
 * QuestionGenerator - 直接使用课程内容生成选项
 *
 * 核心原则：选项结构是固定的，内容来自 reference/ 目录中的课程数据
 * LLM 只负责生成教学内容，不负责生成选项结构
 */
export class QuestionGenerator {
  /**
   * 生成概念列表选项
   * 直接使用 lecture.teachingPoints 数据，不需要 LLM
   */
  generateConceptListOptions(lecture: LectureWithPoints): Question {
    // 直接用 teachingPoints 构建选项
    const conceptOptions: QuestionOption[] = lecture.teachingPoints.map((tp, i) => ({
      label: `${i + 1}. ${tp.concept}`,
      description: tp.explanation.substring(0, 60) + (tp.explanation.length > 60 ? '...' : ''),
      value: `concept:${i}`
    }));

    // 添加通用选项
    const options: QuestionOption[] = [
      ...conceptOptions,
      {
        label: '从头开始',
        description: '按顺序学习第一个概念',
        value: 'concept:0'
      },
      {
        label: '我想问问题',
        description: '关于课程的问题',
        value: 'ask'
      }
    ];

    return {
      question: '你想学习哪个概念？',
      header: '选择',
      options,
      multiSelect: false
    };
  }

  /**
   * 生成概念介绍问题
   * 直接使用 teachingPoint.question 和预设选项模板
   */
  generateIntroduceQuestion(teachingPoint: TeachingPoint, _userName?: string): Question {
    // 使用 teachingPoint.question 作为问题
    const questionText = teachingPoint.question ||
      `你能用自己的话说说"${teachingPoint.concept}"是什么意思吗？`;

    // 预设的验证选项（理解、应用、练习三层）
    const options: QuestionOption[] = [
      {
        label: '我理解了',
        description: '概念已经清楚，可以继续',
        value: 'correct'
      },
      {
        label: '有点模糊',
        description: '还需要举个例子',
        value: 'need_example'
      },
      {
        label: '完全不懂',
        description: '需要换个角度解释',
        value: 'not_understand'
      }
    ];

    return {
      question: questionText,
      header: '理解检查',
      options,
      multiSelect: false
    };
  }

  /**
   * 生成验证理解问题
   * 直接使用预设问题模板 + teachingPoint 数据
   */
  generateVerifyQuestion(
    teachingPoint: TeachingPoint,
    phase: TeachingPhase,
    _userAnswer?: string
  ): Question {
    const phaseConfig = {
      introduce: {
        header: '理解检查',
        question: `你能用自己的话说说"${teachingPoint.concept}"是什么意思吗？`,
        options: [
          { label: '我理解了', description: '能用自己的话解释', value: 'correct' },
          { label: '有点模糊', description: '还需要更多例子', value: 'need_example' },
          { label: '不太懂', description: '需要换个角度', value: 'not_understand' }
        ]
      },
      verify: {
        header: '应用检查',
        question: `如果让你在实际场景中使用"${teachingPoint.concept}"，你会怎么做？`,
        options: [
          { label: '我知道怎么用', description: '能给出一个实际例子', value: 'correct' },
          { label: '大概知道', description: '但不确定细节', value: 'partial' },
          { label: '不知道怎么用', description: '需要更多指导', value: 'not_understand' }
        ]
      },
      practice: {
        header: '练习',
        question: `写一段代码或描述，展示"${teachingPoint.concept}"的应用`,
        options: [
          { label: '我能写出来', description: '有代码或描述', value: 'correct' },
          { label: '能说但不能写', description: '需要更多示例', value: 'partial' },
          { label: '完全不会', description: '需要手把手教', value: 'not_understand' }
        ]
      },
      mastery: {
        header: '掌握确认',
        question: `现在你能解释清楚"${teachingPoint.concept}"，并用它解决一个新问题吗？`,
        options: [
          { label: '完全掌握', description: '能解释能应用', value: 'correct' },
          { label: '基本掌握', description: '还有一些细节', value: 'partial' },
          { label: '还不熟练', description: '需要再练练', value: 'not_understand' }
        ]
      }
    };

    const config = phaseConfig[phase];

    return {
      question: config.question,
      header: config.header,
      options: config.options,
      multiSelect: false
    };
  }

  /**
   * 生成下一个概念选项
   * 直接构建，不需要 LLM
   */
  generateNextConceptOptions(
    currentIndex: number,
    totalConcepts: number,
    remainingConcepts: TeachingPoint[]
  ): Question {
    const options: QuestionOption[] = [];

    // 如果还有下一个概念，提供继续选项
    if (currentIndex < totalConcepts - 1 && remainingConcepts.length > 0) {
      const nextConcept = remainingConcepts[0];
      options.push({
        label: `下一个：${nextConcept.concept}`,
        description: nextConcept.explanation.substring(0, 50) + '...',
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
}
