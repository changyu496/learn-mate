import { describe, it, expect } from 'vitest';
import { CurriculumParser } from './parser.js';
import * as path from 'path';

describe('CurriculumParser', () => {
  const coursePath = '/Users/changyu/Project/llm-tutor/reference/learn-harness-engineering/docs/zh/lectures';
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