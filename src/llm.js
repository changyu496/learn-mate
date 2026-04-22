// Minimal OpenAI-compatible chat completion client.
// Works with OpenAI, DashScope/Qwen, DeepSeek, 智谱 etc. via the same HTTP interface.

const DEFAULT_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_MODEL = 'qwen-plus';

function resolveConfig() {
  const key = process.env.OPENAI_API_KEY || process.env.DASHSCOPE_API_KEY;
  if (!key) {
    throw new Error('未设置 OPENAI_API_KEY（或 DASHSCOPE_API_KEY）');
  }
  return {
    apiKey: key,
    baseUrl: process.env.OPENAI_BASE_URL || DEFAULT_BASE_URL,
    model: process.env.LEARN_MATE_MODEL || DEFAULT_MODEL
  };
}

export async function chatComplete({ messages, responseFormat, temperature = 0.2, timeoutMs = 60000 }) {
  const cfg = resolveConfig();
  const body = {
    model: cfg.model,
    messages,
    temperature
  };
  if (responseFormat) body.response_format = responseFormat;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LLM API ${res.status}: ${text.slice(0, 500)}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}
