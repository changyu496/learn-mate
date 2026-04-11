export interface User {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

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