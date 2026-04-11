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