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