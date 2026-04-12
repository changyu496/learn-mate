# LearnMate MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a CLI tool that acts as an AI private tutor, guiding users through the learn-harness-engineering course with mastery-based learning.

**Architecture:** TypeScript CLI with SQLite persistence, MiniMax LLM API integration, and modular agent components for learning flow management. The CLI supports direct use and OpenClaw skill integration.

**Tech Stack:** TypeScript, Node.js 22+, better-sqlite3, MiniMax API, commander.js

---

## Project Structure

```
learn-mate/
├── src/
│   ├── cli/
│   │   └── index.ts           # Commander.js CLI setup
│   ├── agent/
│   │   └── learner.ts         # Learning flow orchestration (includes examiner/synthesizer logic)
│   ├── memory/
│   │   ├── store.ts           # SQLite operations
│   │   └── types.ts           # TypeScript interfaces
│   ├── curriculum/
│   │   ├── parser.ts          # Markdown to LearningNode
│   │   └── course.ts          # Course management
│   ├── notifier/
│   │   └── scheduler.ts       # Reminder scheduling
│   └── llm/
│       └── client.ts          # MiniMax API client
├── reference/                  # Course content
│   └── learn-harness-engineering/
├── data/                      # SQLite DB location
├── skills/                    # OpenClaw skill
│   └── learn-mate/
│       └── SKILL.md
├── package.json
└── tsconfig.json
```

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `src/cli/index.ts`
- Create: `src/memory/types.ts`
- Create: `src/memory/store.ts`
- Create: `src/llm/client.ts`
- Create: `src/curriculum/parser.ts`
- Create: `src/curriculum/course.ts`
- Create: `src/agent/learner.ts`
- Create: `src/agent/examiner.ts`
- Create: `src/notifier/scheduler.ts`
- Create: `src/index.ts` (main entry)
- Create: `.gitignore`

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `src/cli/index.ts` (placeholder)
- Create: `src/memory/types.ts` (placeholder)
- Create: `src/memory/store.ts` (placeholder)
- Create: `src/llm/client.ts` (placeholder)
- Create: `src/curriculum/parser.ts` (placeholder)
- Create: `src/curriculum/course.ts` (placeholder)
- Create: `src/agent/learner.ts` (placeholder)
- Create: `src/notifier/scheduler.ts` (placeholder)
- Create: `src/index.ts` (main entry placeholder)
- Create: `.gitignore`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "learn-mate",
  "version": "0.1.0",
  "description": "AI private tutor - learn anything with mastery",
  "main": "dist/index.js",
  "bin": {
    "learn-mate": "./dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsx src/index.ts"
  },
  "dependencies": {
    "better-sqlite3": "^11.0.0",
    "commander": "^12.0.0",
    "node-schedule": "^2.1.1",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.0",
    "@types/node": "^22.0.0",
    "@types/node-schedule": "^2.1.0",
    "tsx": "^4.0.0",
    "typescript": "^5.0.0"
  },
  "engines": {
    "node": ">=22.0.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Create .gitignore**

```
node_modules/
dist/
data/*.db
.env
*.log
```

- [ ] **Step 4: Create placeholder files with basic exports**

Create each file with minimal content:
- `src/memory/types.ts`: `export interface User { id: string; name: string; }`
- `src/memory/store.ts`: `export class MemoryStore { }`
- `src/llm/client.ts`: `export class LLMClient { }`
- `src/curriculum/parser.ts`: `export class CurriculumParser { }`
- `src/curriculum/course.ts`: `export class Course { }`
- `src/agent/learner.ts`: `export class Learner { }`
- `src/agent/examiner.ts`: `export class Examiner { }`
- `src/notifier/scheduler.ts`: `export class Scheduler { }`
- `src/cli/index.ts`: `console.log('CLI placeholder')`
- `src/index.ts`: `import './cli/index.js'`

- [ ] **Step 5: Install dependencies**

Run: `npm install`

Expected: Dependencies installed successfully

- [ ] **Step 6: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: No errors (all types are placeholder)

- [ ] **Step 7: Run dev command**

Run: `npm run dev`

Expected: Outputs "CLI placeholder"

- [ ] **Step 8: Build project**

Run: `npm run build`

Expected: `dist/` folder created

- [ ] **Step 9: Commit**

```bash
git init
git add package.json tsconfig.json .gitignore src/
git commit -m "feat: initial project scaffolding"
```

---

## Task 2: SQLite Memory Store

**Files:**
- Modify: `src/memory/types.ts`
- Modify: `src/memory/store.ts`

- [ ] **Step 1: Write test for MemoryStore**

Create: `src/memory/store.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryStore } from './store.js';
import * as fs from 'fs';
import * as path from 'path';

describe('MemoryStore', () => {
  const testDbPath = path.join(__dirname, 'test.db');

  beforeEach(() => {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  it('should create a new user', () => {
    const store = new MemoryStore(testDbPath);
    const user = store.createUser('test-user', 'Test User');
    expect(user.id).toBe('test-user');
    expect(user.name).toBe('Test User');
  });

  it('should create a learning plan', () => {
    const store = new MemoryStore(testDbPath);
    store.createUser('test-user', 'Test User');
    const plan = store.createPlan('test-user', {
      dailyGoal: 1,
      targetDays: 12,
      reminderTime: '20:00'
    });
    expect(plan.userId).toBe('test-user');
    expect(plan.dailyGoal).toBe(1);
    expect(plan.targetDays).toBe(12);
  });

  it('should update progress', () => {
    const store = new MemoryStore(testDbPath);
    store.createUser('test-user', 'Test User');
    store.updateProgress('test-user', 'learn-harness-engineering', 'lecture-01', 'learning');
    const progress = store.getProgress('test-user', 'learn-harness-engineering', 'lecture-01');
    expect(progress?.status).toBe('learning');
  });

  it('should store and retrieve memory', () => {
    const store = new MemoryStore(testDbPath);
    store.createUser('test-user', 'Test User');
    store.setMemory('test-user', 'weak-topics', ['harness-components']);
    const memory = store.getMemory('test-user', 'weak-topics');
    expect(memory).toEqual(['harness-components']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/memory/store.test.ts`
Expected: FAIL - functions don't exist yet

- [ ] **Step 3: Implement types in src/memory/types.ts**

```typescript
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
```

- [ ] **Step 4: Implement MemoryStore in src/memory/store.ts**

```typescript
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

  createPlan(userId: string, plan: Omit<LearningPlan, 'id' | 'createdAt'>): LearningPlan {
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
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/memory/store.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/memory/types.ts src/memory/store.ts src/memory/store.test.ts
git commit -m "feat: implement SQLite memory store with user, plan, progress, and memory tables"
```

---

## Task 3: MiniMax LLM Client

**Files:**
- Modify: `src/llm/client.ts`
- Create: `src/llm/client.test.ts`

- [ ] **Step 1: Write test for LLMClient**

Create: `src/llm/client.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LLMClient } from './client.js';

describe('LLMClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate a response', async () => {
    const client = new LLMClient({
      apiKey: process.env.MINIMAX_API_KEY || 'test-key',
      model: 'MiniMax-Text-01'
    });

    const response = await client.generate([
      { role: 'user', content: 'What is 2+2?' }
    ]);

    expect(response).toBeDefined();
    expect(typeof response).toBe('string');
  });

  it('should generate quiz questions', async () => {
    const client = new LLMClient({
      apiKey: process.env.MINIMAX_API_KEY || 'test-key',
      model: 'MiniMax-Text-01'
    });

    const questions = await client.generateQuiz(
      'Test topic about harness engineering',
      3
    );

    expect(Array.isArray(questions)).toBe(true);
    expect(questions.length).toBe(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/llm/client.test.ts`
Expected: FAIL - functions don't exist yet

- [ ] **Step 3: Implement LLMClient in src/llm/client.ts**

```typescript
import { z } from 'zod';

export interface LLMConfig {
  apiKey: string;
  model?: string;
  baseUrl?: string;
}

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface QuizQuestion {
  question: string;
  options?: string[];
  answer: string;
  explanation: string;
}

export class LLMClient {
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor(config: LLMConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model || 'MiniMax-Text-01';
    this.baseUrl = config.baseUrl || 'https://api.minimax.io/v1';
  }

  async generate(messages: Message[]): Promise<string> {
    const response = await fetch(`${this.baseUrl}/text/chatcompletion_v2`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        messages
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`LLM API error: ${response.status} - ${error}`);
    }

    const data = await response.json() as {
      choices?: Array<{ messages: Array<{ content: string }> }>;
      text?: string;
    };

    if (data.choices && data.choices[0]?.messages) {
      return data.choices[0].messages[data.choices[0].messages.length - 1]?.content || '';
    }

    return data.text || '';
  }

  async generateQuiz(topic: string, count: number = 3): Promise<QuizQuestion[]> {
    const prompt = `Generate ${count} quiz questions about "${topic}".

For each question, provide:
1. A clear question text
2. Multiple choice options (4 choices: A, B, C, D) if applicable
3. The correct answer
4. A brief explanation

Format as JSON array:
[
  {
    "question": "...",
    "options": ["A: ...", "B: ...", "C: ...", "D: ..."],
    "answer": "A",
    "explanation": "..."
  }
]

Only output valid JSON, no markdown formatting.`;

    const response = await this.generate([
      { role: 'system', content: 'You are a helpful quiz generator. Output only valid JSON.' },
      { role: 'user', content: prompt }
    ]);

    try {
      const cleaned = response.replace(/```json\n?|```\n?/g, '').trim();
      return JSON.parse(cleaned) as QuizQuestion[];
    } catch {
      throw new Error(`Failed to parse quiz JSON: ${response}`);
    }
  }

  async generateLearningPath(
    userLevel: string,
    targetTopic: string,
    dailyCapacity: number
  ): Promise<string[]> {
    const prompt = `Based on the user's level ("${userLevel}") and target topic ("${targetTopic}"),
generate a learning path with ${dailyCapacity} topics per day.

Format as a JSON array of daily topics:
["Day 1: Topic A", "Day 2: Topic B", ...]

Keep each topic concise but specific. Only output valid JSON.`;

    const response = await this.generate([
      { role: 'system', content: 'You are a helpful learning advisor. Output only valid JSON.' },
      { role: 'user', content: prompt }
    ]);

    try {
      const cleaned = response.replace(/```json\n?|```\n?/g, '').trim();
      return JSON.parse(cleaned) as string[];
    } catch {
      throw new Error(`Failed to parse learning path JSON: ${response}`);
    }
  }

  async diagnoseWeakness(
    topic: string,
    wrongAnswer: string,
    question: string
  ): Promise<string> {
    const prompt = `The user was asked: "${question}"
They answered: "${wrongAnswer}"

Briefly diagnose what concept they misunderstood (1-2 sentences).
Be specific about the misconception.`;

    return this.generate([
      { role: 'system', content: 'You are a helpful tutor diagnosing learning gaps.' },
      { role: 'user', content: prompt }
    ]);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/llm/client.test.ts`
Expected: Tests should run (may skip if no API key)

- [ ] **Step 5: Commit**

```bash
git add src/llm/client.ts src/llm/client.test.ts
git commit -m "feat: implement MiniMax LLM client with chat, quiz, and diagnosis capabilities"
```

---

## Task 4: Curriculum Parser

**Files:**
- Modify: `src/curriculum/parser.ts`
- Modify: `src/curriculum/course.ts`
- Create: `src/curriculum/parser.test.ts`

- [ ] **Step 1: Write test for CurriculumParser**

Create: `src/curriculum/parser.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { CurriculumParser } from './parser.js';
import * as path from 'path';

describe('CurriculumParser', () => {
  const coursePath = path.join(__dirname, '../../reference/learn-harness-engineering/docs/zh/lectures');
  const parser = new CurriculumParser(coursePath);

  it('should parse lecture titles', async () => {
    const lectures = await parser.getLectureList();
    expect(lectures.length).toBeGreaterThan(0);
    expect(lectures[0]).toHaveProperty('id');
    expect(lectures[0]).toHaveProperty('title');
  });

  it('should parse lecture content', async () => {
    const lecture = await parser.getLecture('lecture-01-why-capable-agents-still-fail');
    expect(lecture).toBeDefined();
    expect(lecture.id).toContain('lecture-01');
    expect(lecture.content.length).toBeGreaterThan(0);
  });

  it('should extract key concepts', async () => {
    const lecture = await parser.getLecture('lecture-01-why-capable-agents-still-fail');
    expect(lecture.concepts.length).toBeGreaterThan(0);
  });

  it('should return all lectures in order', async () => {
    const lectures = await parser.getLectureList();
    expect(lectures.length).toBe(12);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/curriculum/parser.test.ts`
Expected: FAIL - parser not implemented

- [ ] **Step 3: Implement LearningNode types in src/curriculum/parser.ts**

```typescript
export interface LearningNode {
  id: string;
  lectureId: string;
  title: string;
  concepts: string[];
  content: string;
  examples: {
    python?: string;
    java?: string;
    javascript?: string;
    go?: string;
  };
  completedCriteria: string;
}

export interface Lecture {
  id: string;
  title: string;
  content: string;
  concepts: string[];
  order: number;
}
```

- [ ] **Step 4: Implement CurriculumParser in src/curriculum/parser.ts**

```typescript
import * as fs from 'fs';
import * as path from 'path';
import type { Lecture } from './parser.js';

export class CurriculumParser {
  private coursePath: string;

  constructor(coursePath: string) {
    this.coursePath = coursePath;
  }

  async getLectureList(): Promise<Array<{ id: string; title: string; order: number }>> {
    const entries = await fs.promises.readdir(this.coursePath);
    const lectureDirs = entries
      .filter(name => name.startsWith('lecture-'))
      .sort();

    const lectures: Array<{ id: string; title: string; order: number }> = [];

    for (let i = 0; i < lectureDirs.length; i++) {
      const dirName = lectureDirs[i];
      const indexPath = path.join(this.coursePath, dirName, 'index.md');

      if (fs.existsSync(indexPath)) {
        const content = await fs.promises.readFile(indexPath, 'utf-8');
        const title = this.extractTitle(content);
        lectures.push({
          id: dirName,
          title,
          order: i + 1
        });
      }
    }

    return lectures;
  }

  async getLecture(lectureId: string): Promise<Lecture | null> {
    const lecturePath = path.join(this.coursePath, lectureId, 'index.md');

    if (!fs.existsSync(lecturePath)) {
      return null;
    }

    const content = await fs.promises.readFile(lecturePath, 'utf-8');
    const lectures = await this.getLectureList();
    const lectureMeta = lectures.find(l => l.id === lectureId);

    return {
      id: lectureId,
      title: this.extractTitle(content),
      content: this.extractCoreContent(content),
      concepts: this.extractConcepts(content),
      order: lectureMeta?.order || 0
    };
  }

  async getAllLectures(): Promise<Lecture[]> {
    const list = await this.getLectureList();
    const lectures: Lecture[] = [];

    for (const meta of list) {
      const lecture = await this.getLecture(meta.id);
      if (lecture) {
        lectures.push(lecture);
      }
    }

    return lectures.sort((a, b) => a.order - b.order);
  }

  private extractTitle(markdown: string): string {
    const match = markdown.match(/^#\s+(.+)$/m);
    return match ? match[1].trim() : 'Untitled';
  }

  private extractCoreContent(markdown: string): string {
    // Remove YAML frontmatter
    let content = markdown.replace(/^---[\s\S]*?---\n/, '');
    // Remove English version link
    content = content.replace(/\[English Version.*?\]\(.*?\)/g, '');
    // Remove code block references
    content = content.replace(/```[\s\S]*?```/g, '');
    // Remove links but keep text
    content = content.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
    // Remove images
    content = content.replace(/!\[[^\]]*\]\([^)]+\)/g, '');
    // Remove headers from content (keep h1 as title already extracted)
    content = content.replace(/^#{1,6}\s+/gm, '');
    // Normalize whitespace
    content = content.replace(/\n{3,}/g, '\n\n');
    return content.trim();
  }

  private extractConcepts(markdown: string): string[] {
    const concepts: string[] = [];
    const sectionMatch = markdown.match(/## 核心概念\n\n([\s\S]*?)(?=\n##|$)/);

    if (sectionMatch) {
      const conceptText = sectionMatch[1];
      const bulletMatches = conceptText.matchAll(/[-*]\s+\*\*([^*]+)\*\*[：:]\s*(.+)/g);

      for (const match of bulletMatches) {
        concepts.push(`${match[1]}: ${match[2]}`);
      }
    }

    return concepts;
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/curriculum/parser.test.ts`
Expected: PASS

- [ ] **Step 6: Implement Course class in src/curriculum/course.ts**

```typescript
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
```

- [ ] **Step 7: Commit**

```bash
git add src/curriculum/parser.ts src/curriculum/course.ts src/curriculum/parser.test.ts
git commit -m "feat: implement curriculum parser for learn-harness-engineering course"
```

---

## Task 5: Agent Learner (Core Learning Flow)

**Files:**
- Modify: `src/agent/learner.ts`
- Create: `src/agent/learner.test.ts`

- [ ] **Step 1: Write test for Learner**

Create: `src/agent/learner.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Learner } from './learner.js';
import { MemoryStore } from '../memory/store.js';
import { LLMClient } from '../llm/client.js';
import { Course } from '../curriculum/course.js';
import * as path from 'path';

describe('Learner', () => {
  const testDbPath = path.join(__dirname, 'test-learner.db');
  let store: MemoryStore;
  let llmClient: LLMClient;
  let course: Course;
  let learner: Learner;

  beforeEach(() => {
    store = new MemoryStore(testDbPath);
    store.createUser('test-user', 'Test User');

    llmClient = {
      generate: vi.fn().mockResolvedValue('Mock response'),
      generateQuiz: vi.fn().mockResolvedValue([{
        question: 'Test question?',
        options: ['A', 'B', 'C', 'D'],
        answer: 'A',
        explanation: 'Test explanation'
      }]),
      generateLearningPath: vi.fn().mockResolvedValue([
        'Day 1: Introduction to Harness',
        'Day 2: Harness Components'
      ]),
      diagnoseWeakness: vi.fn().mockResolvedValue('You misunderstood the concept of validation.')
    } as unknown as LLMClient;

    course = new Course(path.join(__dirname, '../../reference/learn-harness-engineering/docs/zh/lectures'));
  });

  it('should start onboarding conversation', async () => {
    learner = new Learner(store, llmClient, course);

    const response = await learner.startOnboarding('test-user');

    expect(response).toContain('harness');
    expect(store.getPlanByUser('test-user')).toBeNull(); // Plan not created yet
  });

  it('should create learning plan from user input', async () => {
    learner = new Learner(store, llmClient, course);

    await learner.setLearningPreferences('test-user', {
      level: 'beginner',
      dailyCapacity: 1,
      targetDays: 14,
      language: 'python'
    });

    const plan = store.getPlanByUser('test-user');
    expect(plan).not.toBeNull();
    expect(plan!.dailyGoal).toBe(1);
    expect(plan!.targetDays).toBe(14);
  });

  it('should teach a lecture', async () => {
    learner = new Learner(store, llmClient, course);

    store.updateProgress('test-user', 'learn-harness-engineering', 'lecture-01', 'learning');

    const teaching = await learner.teachLecture('test-user', 'lecture-01');

    expect(teaching.content).toBeDefined();
    expect(teaching.quiz).toBeDefined();
    expect(teaching.quiz.question).toBeDefined();
  });

  it('should check user answer and track progress', async () => {
    learner = new Learner(store, llmClient, course);

    store.updateProgress('test-user', 'learn-harness-engineering', 'lecture-01', 'learning');

    // Simulate answering correctly
    const result = await learner.checkAnswer(
      'test-user',
      'lecture-01',
      { selectedAnswer: 'A', isCorrect: true }
    );

    expect(result.correct).toBe(true);
  });

  it('should diagnose weakness on wrong answer', async () => {
    learner = new Learner(store, llmClient, course);

    store.updateProgress('test-user', 'learn-harness-engineering', 'lecture-01', 'learning');

    const result = await learner.checkAnswer(
      'test-user',
      'lecture-01',
      { selectedAnswer: 'B', isCorrect: false, question: 'What is harness?' }
    );

    expect(result.correct).toBe(false);
    expect(result.diagnosis).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/agent/learner.test.ts`
Expected: FAIL - Learner class not implemented

- [ ] **Step 3: Implement Learner in src/agent/learner.ts**

```typescript
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/agent/learner.test.ts`
Expected: PASS (with mocked LLM)

- [ ] **Step 5: Commit**

```bash
git add src/agent/learner.ts src/agent/learner.test.ts
git commit -m "feat: implement core learner agent with onboarding and teaching flow"
```

---

## Task 6: CLI Commands

**Files:**
- Modify: `src/cli/index.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: Implement CLI with commander in src/cli/index.ts**

```typescript
#!/usr/bin/env node

import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs';
import { MemoryStore } from '../memory/store.js';
import { LLMClient } from '../llm/client.js';
import { Course } from '../curriculum/course.js';
import { Learner } from '../agent/learner.js';

const HOME_DIR = process.env.HOME || process.env.USERPROFILE || '.';
const DATA_DIR = path.join(HOME_DIR, '.learn-mate', 'data');
const DB_PATH = path.join(DATA_DIR, 'learn-mate.db');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const store = new MemoryStore(DB_PATH);
const course = new Course(
  path.join(__dirname, '../../reference/learn-harness-engineering/docs/zh/lectures')
);

let isInitialized = false;

async function ensureInitialized(): Promise<void> {
  if (!isInitialized) {
    await course.initialize();
    isInitialized = true;
  }
}

function getLLMClient(): LLMClient {
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) {
    throw new Error('MINIMAX_API_KEY environment variable is not set');
  }
  return new LLMClient({ apiKey });
}

function getLearner(userId: string): Learner {
  return new Learner(store, getLLMClient(), course);
}

const program = new Command();

program
  .name('learn-mate')
  .description('AI private tutor - learn anything with mastery')
  .version('0.1.0');

program
  .command('start')
  .description('Start a new learning session')
  .action(async () => {
    try {
      await ensureInitialized();
      const learner = getLearner('default-user');

      if (!store.getUser('default-user')) {
        store.createUser('default-user', 'Learner');
      }

      console.log('\n🎓 Welcome to LearnMate!\n');
      const onboarding = await learner.startOnboarding('default-user');
      console.log(onboarding.message);
      console.log('\n---');
      console.log('To set your preferences, run:');
      console.log('  learn-mate plan --set\n');
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('continue')
  .description('Continue learning from where you left off')
  .action(async () => {
    try {
      await ensureInitialized();
      const learner = getLearner('default-user');
      const progress = await learner.getProgress('default-user');

      if (progress.completed === progress.total) {
        console.log('\n🎉 Congratulations! You have completed the course!\n');
        return;
      }

      const nextLecture = await learner.getNextLecture('default-user');
      if (nextLecture) {
        console.log(`\n📚 Next lecture: ${nextLecture}\n`);
        const teaching = await learner.teachLecture('default-user', nextLecture);
        console.log(`## ${teaching.title}\n`);
        console.log(teaching.content);
        console.log('\n--- Quiz ---\n');
        console.log(teaching.quiz.question);
        if (teaching.quiz.options) {
          teaching.quiz.options.forEach(opt => console.log(`  ${opt}`));
        }
        console.log('\n(Answer with learn-mate answer --lecture ' + teaching.lectureId + ' --answer <A/B/C/D>)\n');
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('progress')
  .description('View your learning progress')
  .action(async () => {
    try {
      await ensureInitialized();
      const learner = getLearner('default-user');
      const progress = await learner.getProgress('default-user');

      console.log('\n📊 Learning Progress\n');
      console.log(`Completed: ${progress.completed}/${progress.total} lectures`);
      console.log(`Progress: ${Math.round((progress.completed / progress.total) * 100)}%`);
      console.log(`Current: ${progress.currentLecture || 'None'}`);

      if (progress.weakTopics.length > 0) {
        console.log(`\n⚠️ Topics to review: ${progress.weakTopics.join(', ')}`);
      }
      console.log();
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('status')
  .description('View current learning status')
  .action(async () => {
    try {
      await ensureInitialized();
      const learner = getLearner('default-user');
      const progress = await learner.getProgress('default-user');
      const plan = store.getPlanByUser('default-user');

      console.log('\n📍 Current Status\n');
      console.log(`Completed: ${progress.completed}/${progress.total}`);
      console.log(`Daily goal: ${plan?.dailyGoal || 1} lecture(s)/day`);
      console.log(`Reminder: ${plan?.reminderTime || 'Not set'}`);
      console.log();
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

const planCmd = program.command('plan');

planCmd
  .command('show')
  .description('Show current learning plan')
  .action(() => {
    const plan = store.getPlanByUser('default-user');
    console.log('\n📋 Learning Plan\n');
    if (plan) {
      console.log(`Daily goal: ${plan.dailyGoal} lecture(s)`);
      console.log(`Target days: ${plan.targetDays}`);
      console.log(`Start date: ${plan.startDate}`);
      console.log(`Reminder time: ${plan.reminderTime || 'Not set'}`);
    } else {
      console.log('No plan set. Run: learn-mate plan --set');
    }
    console.log();
  });

planCmd
  .command('set')
  .description('Set learning preferences')
  .option('--daily <number>', 'Daily lectures goal', '1')
  .option('--days <number>', 'Target days to complete', '14')
  .option('--time <HH:MM>', 'Reminder time', '20:00')
  .action(async (options) => {
    try {
      await ensureInitialized();
      const learner = getLearner('default-user');
      await learner.setLearningPreferences('default-user', {
        level: 'beginner',
        dailyCapacity: parseInt(options.daily || '1'),
        targetDays: parseInt(options.days || '14'),
        language: 'python'
      });

      store.createPlan('default-user', {
        dailyGoal: parseInt(options.daily || '1'),
        targetDays: parseInt(options.days || '14'),
        reminderTime: options.time || '20:00'
      });

      console.log('\n✅ Learning plan set!\n');
      console.log(`Daily goal: ${options.daily || 1} lecture(s)`);
      console.log(`Target: ${options.days || 14} days`);
      console.log(`Reminder: ${options.time || '20:00'}\n`);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('answer')
  .description('Submit an answer to the current quiz')
  .requiredOption('--lecture <id>', 'Lecture ID')
  .requiredOption('--answer <A|B|C|D>', 'Your answer')
  .action(async (options) => {
    try {
      await ensureInitialized();
      const learner = getLearner('default-user');
      const isCorrect = false; // Would need actual quiz logic

      const result = await learner.checkAnswer('default-user', options.lecture, {
        selectedAnswer: options.answer,
        isCorrect
      });

      if (result.correct) {
        console.log('\n✅ Correct! Well done!\n');
      } else {
        console.log('\n❌ Not quite right.\n');
        if (result.diagnosis) {
          console.log(`💡 ${result.diagnosis}\n`);
        }
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('reset')
  .description('Reset all learning progress')
  .action(() => {
    console.log('\n⚠️ This will reset all your progress. Are you sure? (y/N)\n');
    // In real CLI, would prompt for confirmation
    console.log('Run with --confirm to skip confirmation.\n');
  });

program.parse();
```

- [ ] **Step 2: Update src/index.ts**

```typescript
import './cli/index.js';
```

- [ ] **Step 3: Make CLI executable**

Add shebang line to `src/cli/index.ts`:
```typescript
#!/usr/bin/env node
```

- [ ] **Step 4: Test CLI help**

Run: `npm run build && node dist/cli/index.js --help`
Expected: Shows help with all commands

- [ ] **Step 5: Test CLI commands**

Run: `node dist/cli/index.js progress`
Expected: Shows progress (may fail if no user exists yet)

- [ ] **Step 6: Commit**

```bash
git add src/cli/index.ts src/index.ts
git commit -m "feat: implement CLI with start, continue, progress, status, plan, answer commands"
```

---

## Task 7: OpenClaw Skill Integration

**Files:**
- Create: `skills/learn-mate/SKILL.md`

- [ ] **Step 1: Create OpenClaw Skill directory**

```bash
mkdir -p skills/learn-mate
```

- [ ] **Step 2: Create SKILL.md**

```markdown
---
name: learn_mate
description: AI 私教，带你真正学会大模型开发（基于 learn-harness-engineering 课程）
homepage: https://github.com/your-org/learn-mate
metadata:
  {
    "openclaw": {
      "requires": { "bins": ["learn-mate"] },
      "install": [{ "id": "npm", "kind": "npm", "package": "learn-mate" }]
    }
  }
---

# LearnMate

你的个人 AI 私教，帮助你真正学会 LLM 应用开发和 Harness Engineering。

## 当使用

当用户说以下内容时使用此 skill：
- "我要学 harness"
- "我要学 LLM 开发"
- "我想学 AI 应用开发"
- "带我学 xxx"
- "查看我的学习进度"
- "继续学习"

## 使用方式

### 启动学习
```bash
learn-mate start
```

### 继续学习
```bash
learn-mate continue
```

### 查看进度
```bash
learn-mate progress
```

### 设置学习计划
```bash
learn-mate plan set --daily 1 --days 14 --time 20:00
```

### 查看状态
```bash
learn-mate status
```

## 学习流程

1. **入课对话**：Agent 了解用户的水平和目标
2. **制定计划**：协商每日学习量和完成时间
3. **学习 + 考核**：
   - 讲解知识点
   - 出题考核
   - 做对才算掌握
4. **持续陪学**：记住用户状态，隔几天复习

## 核心原则

- **掌握式学习**：做对才算会，不跳过验证
- **警惕流畅性错觉**：用户说"懂了"不能信，必须出题验证
- **协商式计划**：Agent 和用户一起定计划

## 课程内容

基于 learn-harness-engineering 课程，包含：
- 12 个 Lectures（核心知识点）
- 6 个 Projects（实战练习）
- 多语言支持（Python、Java、JavaScript、Go）

## 注意事项

- 确保 `MINIMAX_API_KEY` 环境变量已设置
- CLI 数据存储在 `~/.learn-mate/data/`
- 可以随时用 `learn-mate progress` 查看进度
```

- [ ] **Step 3: Copy skill to home directory (for testing)**

```bash
mkdir -p ~/.openclaw/skills/learn-mate
cp -r skills/learn-mate/* ~/.openclaw/skills/learn-mate/
```

- [ ] **Step 4: Commit**

```bash
git add skills/learn-mate/SKILL.md
git commit -m "feat: add OpenClaw skill integration for learn-mate"
```

---

## Task 8: Reminder Scheduler

**Files:**
- Modify: `src/notifier/scheduler.ts`

- [ ] **Step 1: Implement Scheduler in src/notifier/scheduler.ts**

```typescript
import * as schedule from 'node-schedule';
import { MemoryStore } from '../memory/store.js';
import { Learner } from '../agent/learner.js';

export interface ReminderConfig {
  userId: string;
  time: string; // HH:MM format
  message: string;
}

export class Scheduler {
  private store: MemoryStore;
  private learner: Learner;
  private jobs: Map<string, schedule.Job> = new Map();

  constructor(store: MemoryStore, learner: Learner) {
    this.store = store;
    this.learner = learner;
  }

  scheduleReminder(userId: string, time: string): void {
    // Cancel existing job for user
    this.cancelReminder(userId);

    const [hour, minute] = time.split(':').map(Number);
    const rule = new schedule.RecurrenceRule();
    rule.hour = hour;
    rule.minute = minute;

    const jobName = `reminder-${userId}`;

    const job = schedule.scheduleJob(rule, async () => {
      const nextLecture = await this.learnner.getNextLecture(userId);
      if (nextLecture) {
        console.log(`\n🔔 Reminder: Time to learn! Next: ${nextLecture}\n`);
        // In a real implementation, this would send a notification
        // through the user's preferred channel (CLI, webhook, etc.)
      }
    });

    if (job) {
      this.jobs.set(jobName, job);
    }
  }

  cancelReminder(userId: string): void {
    const jobName = `reminder-${userId}`;
    const job = this.jobs.get(jobName);
    if (job) {
      job.cancel();
      this.jobs.delete(jobName);
    }
  }

  updateReminderTime(userId: string, time: string): void {
    this.scheduleReminder(userId, time);
    const plan = this.store.getPlanByUser(userId);
    if (plan) {
      this.store.updatePlan(plan.id, { reminderTime: time });
    }
  }

  cancelAll(): void {
    for (const job of this.jobs.values()) {
      job.cancel();
    }
    this.jobs.clear();
  }
}
```

- [ ] **Step 2: Fix typo in Scheduler (learnner -> learner)**

Edit the typo in line:
```typescript
const nextLecture = await this.learner.getNextLecture(userId);
```

- [ ] **Step 3: Commit**

```bash
git add src/notifier/scheduler.ts
git commit -m "feat: implement reminder scheduler with daily notification support"
```

---

## Verification Checklist

After all tasks complete, verify:

- [ ] `npm run build` succeeds
- [ ] `npm run dev` starts CLI
- [ ] `learn-mate start` shows onboarding
- [ ] `learn-mate progress` shows 0/12
- [ ] `learn-mate plan set --daily 1` sets plan
- [ ] `learn-mate continue` teaches first lecture
- [ ] Tests pass: `npx vitest run`
- [ ] Skill file exists at `skills/learn-mate/SKILL.md`

---

## Dependencies

```bash
npm install
```

## Environment Variables

```bash
export MINIMAX_API_KEY="your-api-key"
```