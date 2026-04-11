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