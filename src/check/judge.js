import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chatComplete } from '../llm.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = path.join(__dirname, '..', '..', 'prompts');

async function buildFilesBlock(inputPaths, projectPath) {
  const blocks = [];
  for (const rel of inputPaths || []) {
    const full = path.join(projectPath, rel);
    try {
      const content = await fs.readFile(full, 'utf8');
      blocks.push(`===== BEGIN ${rel} =====\n${content}\n===== END ${rel} =====`);
    } catch (e) {
      blocks.push(`===== MISSING ${rel} ===== (${e.code || e.message})`);
    }
  }
  return blocks.join('\n\n');
}

async function loadPrompt(checkId) {
  const file = path.join(PROMPTS_DIR, `judge-${checkId}.txt`);
  return fs.readFile(file, 'utf8');
}

function parseLooseJson(raw) {
  // Some models wrap JSON in ```json ... ``` despite response_format. Strip it.
  const trimmed = raw.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  const body = fenceMatch ? fenceMatch[1] : trimmed;
  return JSON.parse(body);
}

async function runOne(check, projectPath) {
  const tpl = await loadPrompt(check.id);
  const files = await buildFilesBlock(check.inputPaths, projectPath);
  const prompt = tpl.replace('{{FILES}}', files);

  const raw = await chatComplete({
    messages: [
      { role: 'system', content: '你是严谨的教学助教。只返回指定格式的 JSON，不要附加解释或 markdown。' },
      { role: 'user', content: prompt }
    ],
    responseFormat: { type: 'json_object' },
    temperature: 0.2
  });

  let parsed;
  try {
    parsed = parseLooseJson(raw);
  } catch (e) {
    return {
      id: check.id,
      description: check.description,
      ok: false,
      detail: `LLM 返回不是合法 JSON：${e.message}`,
      raw: raw.slice(0, 500)
    };
  }

  return {
    id: check.id,
    description: check.description,
    ok: !!parsed.pass,
    parsed
  };
}

export async function runLlmChecks(checks, projectPath) {
  const out = [];
  for (const c of checks || []) {
    try {
      out.push(await runOne(c, projectPath));
    } catch (e) {
      out.push({
        id: c.id,
        description: c.description,
        ok: false,
        detail: `调用失败：${e.message}`
      });
    }
  }
  return out;
}
