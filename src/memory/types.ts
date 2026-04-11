// 用户
export interface User {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

// 用户画像
export interface UserProfile {
  id: string;
  name: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  preferredLanguage: 'python' | 'java' | 'javascript' | 'go';
  learningStyle: 'slow' | 'fast' | 'deep' | 'practical';
  interests: string[];
  goals: string;
  teachingStyle: 'serious' | 'friendly' | 'encouraging';  // Agent 风格
  createdAt: Date;
  updatedAt: Date;
}

// 学习记录
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

// 对话历史
export interface ConversationHistory {
  id: number;
  userId: string;
  lectureId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
}

// 保留原有接口（兼容性）
export interface LearningPlan {
  id: number;
  userId: string;
  dailyGoal: number;
  targetDays: number;
  startDate: string;
  reminderTime: string | null;
  createdAt: Date;
}

export interface Progress {
  id: number;
  userId: string;
  courseId: string;
  lectureId: string;
  status: 'not_started' | 'learning' | 'mastered';
  attempts: number;
  masteredAt: Date | null;
}

export interface Memory {
  id: number;
  userId: string;
  key: string;
  value: string;
  createdAt: Date;
}
