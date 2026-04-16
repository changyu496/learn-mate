import Database from 'better-sqlite3';
import type { UserProfile, LearningRecord, ConversationHistory, LearningPlan, Progress, Memory, User, TeachingState } from './types.js';

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

      CREATE TABLE IF NOT EXISTS user_profiles (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        level TEXT NOT NULL DEFAULT 'beginner',
        preferred_language TEXT NOT NULL DEFAULT 'python',
        learning_style TEXT NOT NULL DEFAULT 'practical',
        interests TEXT NOT NULL DEFAULT '[]',
        goals TEXT NOT NULL DEFAULT '',
        teaching_style TEXT NOT NULL DEFAULT 'friendly',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS learning_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        lecture_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'not_started',
        attempts INTEGER DEFAULT 0,
        weak_points TEXT NOT NULL DEFAULT '[]',
        讲解偏好 TEXT NOT NULL DEFAULT '[]',
        last_reviewed DATETIME DEFAULT CURRENT_TIMESTAMP,
        mastered_at DATETIME,
        FOREIGN KEY (user_id) REFERENCES users(id),
        UNIQUE(user_id, lecture_id)
      );

      CREATE TABLE IF NOT EXISTS conversation_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        lecture_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
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

  // 用户画像操作
  createUserProfile(id: string, name: string): UserProfile {
    const stmt = this.db.prepare(`
      INSERT INTO user_profiles (id, name, level, preferred_language, learning_style, interests, goals, teaching_style, created_at, updated_at)
      VALUES (?, ?, 'beginner', 'python', 'practical', '[]', '', 'friendly', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);
    stmt.run(id, name);
    return this.getUserProfile(id)!;
  }

  getUserProfile(id: string): UserProfile | null {
    const stmt = this.db.prepare('SELECT * FROM user_profiles WHERE id = ?');
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    if (!row) return null;
    return {
      id: row.id as string,
      name: row.name as string,
      level: row.level as UserProfile['level'],
      preferredLanguage: row.preferred_language as UserProfile['preferredLanguage'],
      learningStyle: row.learning_style as UserProfile['learningStyle'],
      interests: JSON.parse(row.interests as string || '[]'),
      goals: row.goals as string,
      teachingStyle: row.teaching_style as UserProfile['teachingStyle'],
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }

  updateUserProfile(id: string, updates: Partial<UserProfile>): void {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (updates.level !== undefined) {
      fields.push('level = ?');
      values.push(updates.level);
    }
    if (updates.preferredLanguage !== undefined) {
      fields.push('preferred_language = ?');
      values.push(updates.preferredLanguage);
    }
    if (updates.learningStyle !== undefined) {
      fields.push('learning_style = ?');
      values.push(updates.learningStyle);
    }
    if (updates.interests !== undefined) {
      fields.push('interests = ?');
      values.push(JSON.stringify(updates.interests));
    }
    if (updates.goals !== undefined) {
      fields.push('goals = ?');
      values.push(updates.goals);
    }
    if (updates.teachingStyle !== undefined) {
      fields.push('teaching_style = ?');
      values.push(updates.teachingStyle);
    }

    if (fields.length > 0) {
      fields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(id);
      const stmt = this.db.prepare(`UPDATE user_profiles SET ${fields.join(', ')} WHERE id = ?`);
      stmt.run(...values);
    }
  }

  // 学习记录操作
  createOrUpdateLearningRecord(userId: string, lectureId: string): LearningRecord {
    const stmt = this.db.prepare(`
      INSERT INTO learning_records (user_id, lecture_id, status, attempts, weak_points, 讲解偏好, last_reviewed)
      VALUES (?, ?, 'in_progress', 1, '[]', '[]', CURRENT_TIMESTAMP)
      ON CONFLICT(user_id, lecture_id) DO UPDATE SET
        status = CASE WHEN status = 'mastered' THEN status ELSE 'in_progress' END,
        attempts = attempts + 1,
        last_reviewed = CURRENT_TIMESTAMP
    `);
    stmt.run(userId, lectureId);
    return this.getLearningRecord(userId, lectureId)!;
  }

  getLearningRecord(userId: string, lectureId: string): LearningRecord | null {
    const stmt = this.db.prepare('SELECT * FROM learning_records WHERE user_id = ? AND lecture_id = ?');
    const row = stmt.get(userId, lectureId) as Record<string, unknown> | undefined;
    if (!row) return null;
    return {
      id: row.id as number,
      userId: row.user_id as string,
      lectureId: row.lecture_id as string,
      status: row.status as LearningRecord['status'],
      attempts: row.attempts as number,
      weakPoints: JSON.parse(row.weak_points as string || '[]'),
      讲解偏好: JSON.parse(row.讲解偏好 as string || '[]'),
      lastReviewed: new Date(row.last_reviewed as string),
      masteredAt: row.mastered_at ? new Date(row.mastered_at as string) : null,
    };
  }

  markLectureMastered(userId: string, lectureId: string): void {
    const stmt = this.db.prepare(`
      UPDATE learning_records
      SET status = 'mastered', mastered_at = CURRENT_TIMESTAMP
      WHERE user_id = ? AND lecture_id = ?
    `);
    stmt.run(userId, lectureId);
  }

  addWeakPoint(userId: string, lectureId: string, weakPoint: string): void {
    const record = this.getLearningRecord(userId, lectureId);
    if (!record) return;

    const weakPoints = [...record.weakPoints, weakPoint];
    const stmt = this.db.prepare('UPDATE learning_records SET weak_points = ? WHERE user_id = ? AND lecture_id = ?');
    stmt.run(JSON.stringify(weakPoints), userId, lectureId);
  }

  getAllLearningRecords(userId: string): LearningRecord[] {
    const stmt = this.db.prepare('SELECT * FROM learning_records WHERE user_id = ?');
    const rows = stmt.all(userId) as Record<string, unknown>[];
    return rows.map(row => ({
      id: row.id as number,
      userId: row.user_id as string,
      lectureId: row.lecture_id as string,
      status: row.status as LearningRecord['status'],
      attempts: row.attempts as number,
      weakPoints: JSON.parse(row.weak_points as string || '[]'),
      讲解偏好: JSON.parse(row.讲解偏好 as string || '[]'),
      lastReviewed: new Date(row.last_reviewed as string),
      masteredAt: row.mastered_at ? new Date(row.mastered_at as string) : null,
    }));
  }

  // 对话历史操作
  addConversation(userId: string, lectureId: string, role: 'user' | 'assistant', content: string): void {
    const stmt = this.db.prepare(`
      INSERT INTO conversation_history (user_id, lecture_id, role, content)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(userId, lectureId, role, content);
  }

  getConversationHistory(userId: string, lectureId: string, limit: number = 20): ConversationHistory[] {
    const stmt = this.db.prepare(`
      SELECT * FROM conversation_history
      WHERE user_id = ? AND lecture_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `);
    const rows = stmt.all(userId, lectureId, limit) as Record<string, unknown>[];
    return rows.map(row => ({
      id: row.id as number,
      userId: row.user_id as string,
      lectureId: row.lecture_id as string,
      role: row.role as 'user' | 'assistant',
      content: row.content as string,
      createdAt: new Date(row.created_at as string),
    })).reverse();
  }

  getLatestLecture(userId: string): string | null {
    const stmt = this.db.prepare(`
      SELECT lecture_id FROM conversation_history
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `);
    const row = stmt.get(userId) as { lecture_id: string } | undefined;
    return row?.lecture_id || null;
  }

  // TeachingState 操作
  setTeachingState(userId: string, state: TeachingState): void {
    this.setMemory(userId, 'teaching_state', state);
  }

  getTeachingState(userId: string): TeachingState | null {
    return this.getMemory<TeachingState>(userId, 'teaching_state');
  }

  clearTeachingState(userId: string): void {
    const stmt = this.db.prepare('DELETE FROM memory WHERE user_id = ? AND key = ?');
    stmt.run(userId, 'teaching_state');
  }

  close(): void {
    this.db.close();
  }
}