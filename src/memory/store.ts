import Database from 'better-sqlite3';
import type { User, LearningPlan, Progress, Memory } from './types.js';

export class MemoryStore {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.init();
  }

  private init(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS plans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        daily_goal INTEGER NOT NULL,
        target_days INTEGER NOT NULL,
        start_date TEXT NOT NULL,
        reminder_time TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS progress (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        course_id TEXT NOT NULL,
        lecture_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'not_started',
        attempts INTEGER DEFAULT 0,
        mastered_at DATETIME,
        FOREIGN KEY (user_id) REFERENCES users(id),
        UNIQUE(user_id, course_id, lecture_id)
      );

      CREATE TABLE IF NOT EXISTS memory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
    `);
  }

  createUser(id: string, name: string): User {
    const stmt = this.db.prepare(
      'INSERT INTO users (id, name) VALUES (?, ?)'
    );
    stmt.run(id, name);
    return this.getUser(id)!;
  }

  getUser(id: string): User | null {
    const stmt = this.db.prepare('SELECT * FROM users WHERE id = ?');
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    if (!row) return null;
    return {
      id: row.id as string,
      name: row.name as string,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }

  createPlan(userId: string, plan: Omit<LearningPlan, 'id' | 'createdAt' | 'userId' | 'startDate'>): LearningPlan {
    const stmt = this.db.prepare(`
      INSERT INTO plans (user_id, daily_goal, target_days, start_date, reminder_time)
      VALUES (?, ?, ?, ?, ?)
    `);
    const startDate = new Date().toISOString().split('T')[0];
    const result = stmt.run(userId, plan.dailyGoal, plan.targetDays, startDate, plan.reminderTime);
    return this.getPlan(result.lastInsertRowid as number)!;
  }

  getPlan(id: number): LearningPlan | null {
    const stmt = this.db.prepare('SELECT * FROM plans WHERE id = ?');
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    if (!row) return null;
    return {
      id: row.id as number,
      userId: row.user_id as string,
      dailyGoal: row.daily_goal as number,
      targetDays: row.target_days as number,
      startDate: row.start_date as string,
      reminderTime: row.reminder_time as string | null,
      createdAt: new Date(row.created_at as string),
    };
  }

  getPlanByUser(userId: string): LearningPlan | null {
    const stmt = this.db.prepare('SELECT * FROM plans WHERE user_id = ? ORDER BY id DESC LIMIT 1');
    const row = stmt.get(userId) as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.getPlan(row.id as number);
  }

  updatePlan(id: number, updates: Partial<LearningPlan>): void {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (updates.dailyGoal !== undefined) {
      fields.push('daily_goal = ?');
      values.push(updates.dailyGoal);
    }
    if (updates.reminderTime !== undefined) {
      fields.push('reminder_time = ?');
      values.push(updates.reminderTime);
    }

    if (fields.length > 0) {
      values.push(id);
      const stmt = this.db.prepare(`UPDATE plans SET ${fields.join(', ')} WHERE id = ?`);
      stmt.run(...values);
    }
  }

  updateProgress(userId: string, courseId: string, lectureId: string, status: Progress['status']): Progress {
    const stmt = this.db.prepare(`
      INSERT INTO progress (user_id, course_id, lecture_id, status)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, course_id, lecture_id)
      DO UPDATE SET status = ?, attempts = attempts + 1
      WHERE status != 'mastered' OR status = 'mastered'
    `);
    stmt.run(userId, courseId, lectureId, status, status);
    return this.getProgress(userId, courseId, lectureId)!;
  }

  getProgress(userId: string, courseId: string, lectureId: string): Progress | null {
    const stmt = this.db.prepare(
      'SELECT * FROM progress WHERE user_id = ? AND course_id = ? AND lecture_id = ?'
    );
    const row = stmt.get(userId, courseId, lectureId) as Record<string, unknown> | undefined;
    if (!row) return null;
    return {
      id: row.id as number,
      userId: row.user_id as string,
      courseId: row.course_id as string,
      lectureId: row.lecture_id as string,
      status: row.status as Progress['status'],
      attempts: row.attempts as number,
      masteredAt: row.mastered_at ? new Date(row.mastered_at as string) : null,
    };
  }

  getAllProgress(userId: string, courseId: string): Progress[] {
    const stmt = this.db.prepare(
      'SELECT * FROM progress WHERE user_id = ? AND course_id = ?'
    );
    const rows = stmt.all(userId, courseId) as Record<string, unknown>[];
    return rows.map(row => ({
      id: row.id as number,
      userId: row.user_id as string,
      courseId: row.course_id as string,
      lectureId: row.lecture_id as string,
      status: row.status as Progress['status'],
      attempts: row.attempts as number,
      masteredAt: row.mastered_at ? new Date(row.mastered_at as string) : null,
    }));
  }

  markMastered(userId: string, courseId: string, lectureId: string): void {
    const stmt = this.db.prepare(`
      UPDATE progress
      SET status = 'mastered', mastered_at = CURRENT_TIMESTAMP
      WHERE user_id = ? AND course_id = ? AND lecture_id = ?
    `);
    stmt.run(userId, courseId, lectureId);
  }

  setMemory(userId: string, key: string, value: unknown): void {
    const stmt = this.db.prepare(`
      INSERT INTO memory (user_id, key, value)
      VALUES (?, ?, ?)
    `);
    stmt.run(userId, key, JSON.stringify(value));
  }

  getMemory<T>(userId: string, key: string): T | null {
    const stmt = this.db.prepare(
      'SELECT value FROM memory WHERE user_id = ? AND key = ? ORDER BY created_at DESC LIMIT 1'
    );
    const row = stmt.get(userId, key) as { value: string } | undefined;
    if (!row) return null;
    return JSON.parse(row.value) as T;
  }

  getAllMemory(userId: string): Record<string, unknown> {
    const stmt = this.db.prepare('SELECT key, value FROM memory WHERE user_id = ?');
    const rows = stmt.all(userId) as { key: string; value: string }[];
    const result: Record<string, unknown> = {};
    for (const row of rows) {
      result[row.key] = JSON.parse(row.value);
    }
    return result;
  }

  close(): void {
    this.db.close();
  }
}