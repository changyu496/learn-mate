import { MemoryStore } from '../memory/store.js';
import { LLMClient, type Message, type QuizQuestion } from '../llm/client.js';
import { Course } from '../curriculum/course.js';

export interface TeachingContent {
  lectureId: string;
  title: string;
  content: string;
  quiz: QuizQuestion;
}

export interface AnswerResult {
  correct: boolean;
  explanation?: string;
  diagnosis?: string;
  attempts: number;
}

export interface OnboardingResponse {
  message: string;
  questions: string[];
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

  async startOnboarding(userId: string): Promise<OnboardingResponse> {
    const messages: Message[] = [
      {
        role: 'system',
        content: `You are a friendly AI tutor for learn-harness-engineering course.
Ask the user about their:
1. Current level with AI/LLM (beginner/intermediate/advanced)
2. How much time they can dedicate daily (in hours)
3. Their learning goal or what they want to achieve
4. Preferred programming language (Python/Java/JavaScript/Go)

Keep questions friendly and concise.`
      },
      {
        role: 'user',
        content: 'I want to start learning about harness engineering. Can you help me set up a learning plan?'
      }
    ];

    const response = await this.llm.generate(messages);

    return {
      message: response,
      questions: [
        'What is your current level with AI/LLM development?',
        'How much time can you dedicate daily?',
        'What is your learning goal?',
        'Preferred programming language?'
      ]
    };
  }

  async setLearningPreferences(
    userId: string,
    preferences: {
      level: string;
      dailyCapacity: number;
      targetDays: number;
      language: string;
    }
  ): Promise<void> {
    this.store.createPlan(userId, {
      dailyGoal: preferences.dailyCapacity,
      targetDays: preferences.targetDays,
      reminderTime: '20:00',
      startDate: new Date().toISOString().split('T')[0]
    });

    this.store.setMemory(userId, 'preferences', preferences);
    this.store.setMemory(userId, 'currentLecture', 'lecture-01');
  }

  async teachLecture(userId: string, lectureId: string): Promise<TeachingContent> {
    const lecture = this.course.getLecture(lectureId);
    if (!lecture) {
      throw new Error(`Lecture not found: ${lectureId}`);
    }

    const preferences = this.store.getMemory<{
      level: string;
      language: string;
    }>(userId, 'preferences');

    const systemPrompt = `You are a tutor teaching "${lecture.title}" from learn-harness-engineering course.
Use simple language suitable for ${preferences?.level || 'beginner'} level.
Focus on ${preferences?.language || 'Python'} examples when possible.

Teach the core concepts in a conversational way, then generate a quiz question to verify understanding.`;

    const messages: Message[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Please teach me: ${lecture.title}` }
    ];

    const teachingContent = await this.llm.generate(messages);
    const quiz = await this.llm.generateQuiz(lecture.concepts.join(', ') || lecture.title, 1);

    this.store.updateProgress(userId, 'learn-harness-engineering', lectureId, 'learning');

    return {
      lectureId,
      title: lecture.title,
      content: teachingContent,
      quiz: quiz[0]
    };
  }

  async checkAnswer(
    userId: string,
    lectureId: string,
    answer: {
      selectedAnswer: string;
      isCorrect: boolean;
      question?: string;
    }
  ): Promise<AnswerResult> {
    const progress = this.store.getProgress(userId, 'learn-harness-engineering', lectureId);

    if (answer.isCorrect) {
      if (progress && progress.attempts >= 2) {
        this.store.markMastered(userId, 'learn-harness-engineering', lectureId);
      }

      return {
        correct: true,
        explanation: 'Correct! Well done.',
        attempts: (progress?.attempts || 0) + 1
      };
    }

    let diagnosis: string | undefined;
    if (answer.question) {
      diagnosis = await this.llm.diagnoseWeakness(
        lectureId,
        answer.selectedAnswer,
        answer.question
      );
      this.store.setMemory(userId, 'weak-topics', [
        ...(this.store.getMemory<string[]>(userId, 'weak-topics') || []),
        lectureId
      ]);
    }

    return {
      correct: false,
      diagnosis,
      attempts: (progress?.attempts || 0) + 1
    };
  }

  async getProgress(userId: string): Promise<{
    completed: number;
    total: number;
    currentLecture: string | null;
    weakTopics: string[];
  }> {
    const progress = this.store.getAllProgress(userId, 'learn-harness-engineering');
    const completed = progress.filter(p => p.status === 'mastered').length;
    const currentLecture = this.store.getMemory<string>(userId, 'currentLecture') || null;
    const weakTopics = this.store.getMemory<string[]>(userId, 'weak-topics') || [];

    return {
      completed,
      total: this.course.getTotalLectures(),
      currentLecture,
      weakTopics
    };
  }

  async getNextLecture(userId: string): Promise<string | null> {
    const progress = this.store.getAllProgress(userId, 'learn-harness-engineering');
    const masteredIds = progress.filter(p => p.status === 'mastered').map(p => p.lectureId);
    const lectures = this.course.getLectures();

    for (const lecture of lectures) {
      if (!masteredIds.includes(lecture.id)) {
        return lecture.id;
      }
    }

    return null;
  }
}