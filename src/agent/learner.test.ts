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

  // Use actual lecture ID from the course
  const actualLectureId = 'lecture-01-why-capable-agents-still-fail';

  beforeEach(() => {
    // Clean up test database before each test
    const fs = require('fs');
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

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

    course = new Course(path.join(__dirname, '../../../reference/learn-harness-engineering/docs/zh/lectures'));
  });

  it('should start onboarding conversation', async () => {
    learner = new Learner(store, llmClient, course);

    const response = await learner.startOnboarding('test-user');

    expect(response.message).toBeDefined();
    expect(response.questions).toBeDefined();
    expect(Array.isArray(response.questions)).toBe(true);
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

    // Initialize the course first
    await course.initialize();

    store.updateProgress('test-user', 'learn-harness-engineering', actualLectureId, 'learning');

    const teaching = await learner.teachLecture('test-user', actualLectureId);

    expect(teaching.content).toBeDefined();
    expect(teaching.quiz).toBeDefined();
    expect(teaching.quiz.question).toBeDefined();
  });

  it('should check user answer and track progress', async () => {
    learner = new Learner(store, llmClient, course);

    store.updateProgress('test-user', 'learn-harness-engineering', actualLectureId, 'learning');

    // Simulate answering correctly
    const result = await learner.checkAnswer(
      'test-user',
      actualLectureId,
      { selectedAnswer: 'A', isCorrect: true }
    );

    expect(result.correct).toBe(true);
  });

  it('should diagnose weakness on wrong answer', async () => {
    learner = new Learner(store, llmClient, course);

    store.updateProgress('test-user', 'learn-harness-engineering', actualLectureId, 'learning');

    const result = await learner.checkAnswer(
      'test-user',
      actualLectureId,
      { selectedAnswer: 'B', isCorrect: false, question: 'What is harness?' }
    );

    expect(result.correct).toBe(false);
    expect(result.diagnosis).toBeDefined();
  });
});