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
    // System message should be separate
    let systemPrompt = '';
    const anthropicMessages: Array<{ role: string; content: Array<{ type: string; text: string }> }> = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemPrompt = msg.content;
      } else {
        anthropicMessages.push({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: [{ type: 'text' as const, text: msg.content }]
        });
      }
    }

    const retry = async (retries: number, attempt: number = 0): Promise<string> => {
      try {
        const requestBody = {
          model: this.model,
          max_tokens: 2048,
          system: systemPrompt,
          messages: anthropicMessages
        };
        console.log(`[LLM] Request #${attempt}: ${JSON.stringify(requestBody).length} chars, system=${systemPrompt.length} chars, ${anthropicMessages.length} messages`);

        const response = await fetch(`${this.baseUrl}/v1/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: this.model,
            max_tokens: 2048,
            system: systemPrompt,
            messages: anthropicMessages
          })
        });

        if (!response.ok) {
          const error = await response.text();
          console.log(`[LLM] Error response (${response.status}): ${error.substring(0, 500)}`);
          // Retry on 500, 502, 503, 504 or API error code 1000
          const isServerError = response.status >= 500 || error.includes('1000') || error.includes('api_error');
          if (isServerError && retries > 0) {
            // Exponential backoff with jitter: 1s, 2s, 4s...
            const delay = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 500, 10000);
            console.log(`[LLM] Server error (${response.status}), retrying in ${Math.round(delay)}ms... (${retries} retries left)`);
            await new Promise(r => setTimeout(r, delay));
            return retry(retries - 1, attempt + 1);
          }
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
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (retries > 0) {
          const delay = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 500, 10000);
          console.log(`[LLM] Network error: ${errorMessage}, retrying in ${Math.round(delay)}ms... (${retries} retries left)`);
          await new Promise(r => setTimeout(r, delay));
          return retry(retries - 1, attempt + 1);
        }
        throw error;
      }
    };

    return retry(5);
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