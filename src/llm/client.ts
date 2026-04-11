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
    this.model = config.model || 'MiniMax-M2.7';
    this.baseUrl = config.baseUrl || 'https://api.minimaxi.com/anthropic';
  }

  async generate(messages: Message[]): Promise<string> {
    // Convert messages to Anthropic format
    const anthropicMessages = messages.map(msg => ({
      role: msg.role,
      content: msg.role === 'user' ? [{ type: 'text' as const, text: msg.content }] : msg.content
    }));

    const response = await fetch(`${this.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        'x-api-id': 'cli'
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 4096,
        messages: anthropicMessages
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`LLM API error: ${response.status} - ${error}`);
    }

    const data = await response.json() as {
      content?: Array<{ type: string; text?: string }>;
    };

    if (data.content && Array.isArray(data.content)) {
      for (const block of data.content) {
        if (block.type === 'text' && block.text) {
          return block.text;
        }
      }
    }

    return '';
  }

  async generateQuiz(topic: string, count: number = 3): Promise<QuizQuestion[]> {
    const prompt = `Generate ${count} quiz question about "${topic}".

Provide:
1. A clear question text
2. Multiple choice options (4 choices: A, B, C, D)
3. The correct answer (just the letter)
4. A brief explanation

Format as JSON array with this exact structure:
[{"question":"...","options":["A: ...","B: ...","C: ...","D: ..."],"answer":"A","explanation":"..."}]

Only output valid JSON, no markdown, no extra text.`;

    const response = await this.generate([
      { role: 'system', content: 'You are a helpful quiz generator. Output only valid JSON array.' },
      { role: 'user', content: prompt }
    ]);

    try {
      // Extract JSON array from response
      const jsonMatch = response.match(/(\[[\s\S]*\])/);
      if (!jsonMatch) {
        throw new Error('No JSON array found in response');
      }
      const cleaned = jsonMatch[1].trim();
      const parsed = JSON.parse(cleaned) as QuizQuestion[];

      // Validate and normalize the quiz
      return parsed.map(q => ({
        question: q.question || '',
        options: Array.isArray(q.options) ? q.options : [],
        answer: q.answer || 'A',
        explanation: q.explanation || ''
      }));
    } catch (error) {
      throw new Error(`Failed to parse quiz JSON: ${response.substring(0, 500)}`);
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