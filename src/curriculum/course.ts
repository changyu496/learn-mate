import { CurriculumParser, type Lecture } from './parser.js';
import type { LearningPlan } from '../memory/types.js';

export interface CourseNode {
  lectureId: string;
  title: string;
  status: 'not_started' | 'learning' | 'mastered';
  order: number;
}

export class Course {
  private parser: CurriculumParser;
  private lectures: Lecture[] = [];

  constructor(coursePath: string) {
    this.parser = new CurriculumParser(coursePath);
  }

  async initialize(): Promise<void> {
    this.lectures = await this.parser.getAllLectures();
  }

  getLectures(): Lecture[] {
    return this.lectures;
  }

  getLecture(id: string): Lecture | undefined {
    return this.lectures.find(l => l.id === id);
  }

  getTotalLectures(): number {
    return this.lectures.length;
  }

  calculateLearningDays(dailyGoal: number): number {
    return Math.ceil(this.lectures.length / dailyGoal);
  }

  generateProgressFromPlan(plan: LearningPlan): CourseNode[] {
    return this.lectures.map((lecture, index) => ({
      lectureId: lecture.id,
      title: lecture.title,
      status: 'not_started' as const,
      order: index + 1
    }));
  }

  getLectureByOrder(order: number): Lecture | undefined {
    return this.lectures.find(l => l.order === order);
  }

  getNextLecture(currentLectureId: string): Lecture | undefined {
    const current = this.lectures.find(l => l.id === currentLectureId);
    if (!current) return undefined;
    return this.lectures.find(l => l.order === current.order + 1);
  }
}