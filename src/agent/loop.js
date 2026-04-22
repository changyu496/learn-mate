// Built-in coding agent loop.
// Talks to an OpenAI-compatible model using a pseudo-tool JSON protocol:
// each turn the model returns ONE JSON object describing the next action.

import fs from 'node:fs/promises';
import path from 'node:path';
import { chatComplete } from '../llm.js';
import { TOOLS } from './tools.js';

const DEFAULT_MAX_TURNS = 20;
const SOFT_WALL_CLOCK_MS = 15 * 60 * 1000;

const SYSTEM_PROMPT = `You are a coding agent working inside a Java 8 + Maven project on the user's machine.

You interact with the project through ONE tool per turn. Respond with a single JSON object, nothing else:

{
  "thought": "short reasoning in 1-2 sentences",
  "action": "list_dir | read_file | write_file | run_shell | finish",
  "args": { ... }
}

Tool signatures:
- list_dir   { "path": "<relative path, '.' for project root>" }
- read_file  { "path": "<relative path>" }
- write_file { "path": "<relative path>", "content": "<FULL new file content>" }
- run_shell  { "cmd": "<single bash command>", "timeoutSec": <1..300, default 120> }
- finish     { "reason": "<why you're stopping>" }

Rules:
- Output MUST be a single JSON object, no markdown fences, no prose around it.
- Use write_file with the FULL file content (not a patch).
- Prefer small steps: inspect before writing, test after writing.
- When the task is complete, or you are stuck after several attempts, call finish.
- The project is a Java 8 Maven CLI. Tests are run with \`mvn -q test\`.`;

function formatToolResult(action, result) {
  // Feed back to the model as compact JSON text.
  try {
    return JSON.stringify({ action, result }, null, 2);
  } catch {
    return `{"action":"${action}","result":{"ok":false,"error":"unserializable"}}`;
  }
}

function parseLooseJson(raw) {
  const trimmed = (raw ?? '').trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  const body = fenced ? fenced[1] : trimmed;
  return JSON.parse(body);
}

function formatHeaderLine(turn, parsed) {
  const act = parsed.action || '?';
  const summary = (() => {
    switch (act) {
      case 'list_dir':   return parsed.args?.path ?? '.';
      case 'read_file':  return parsed.args?.path ?? '';
      case 'write_file': return `${parsed.args?.path ?? ''} (${(parsed.args?.content ?? '').length} chars)`;
      case 'run_shell':  return parsed.args?.cmd ?? '';
      case 'finish':     return parsed.args?.reason ?? '';
      default:           return '';
    }
  })();
  return `[turn ${turn}] ${act.toUpperCase()} ${summary}`;
}

function formatToolLog(action, result) {
  const lines = [];
  if (action === 'list_dir') {
    if (!result.ok) {
      lines.push(`  -> error: ${result.error}`);
    } else {
      lines.push(`  -> ${result.entries.length} entries: ${result.entries.map((e) => e.name + (e.type === 'dir' ? '/' : '')).join(', ')}`);
    }
  } else if (action === 'read_file') {
    if (!result.ok) lines.push(`  -> error: ${result.error}`);
    else lines.push(`  -> ${result.chars} chars${result.truncated ? ' (truncated)' : ''}`);
  } else if (action === 'write_file') {
    if (!result.ok) lines.push(`  -> error: ${result.error}`);
    else lines.push(`  -> wrote ${result.bytes} bytes`);
  } else if (action === 'run_shell') {
    lines.push(`  -> exit=${result.exitCode}, ${result.durationMs}ms${result.timedOut ? ' TIMEOUT' : ''}`);
    if (result.stdout && result.stdout.trim()) {
      lines.push('  stdout:');
      for (const l of result.stdout.split('\n')) lines.push('    ' + l);
    }
    if (result.stderr && result.stderr.trim()) {
      lines.push('  stderr:');
      for (const l of result.stderr.split('\n')) lines.push('    ' + l);
    }
  }
  return lines.join('\n');
}

async function loadProjectInstructions(projectPath) {
  // Claude Code / Cursor / Codex all auto-load AGENTS.md (or CLAUDE.md) into
  // the session context. Without this the course's whole point — "harness
  // changes agent behavior" — cannot land, because the agent has no reason
  // to ever read the harness files on its own.
  const candidates = ['AGENTS.md', 'CLAUDE.md'];
  for (const name of candidates) {
    try {
      const content = await fs.readFile(path.join(projectPath, name), 'utf8');
      return { name, content };
    } catch {}
  }
  return null;
}

export async function runAgent({
  prompt,
  projectPath,
  logFile,
  maxTurns = DEFAULT_MAX_TURNS,
  model,
  onProgress
}) {
  const startWall = Date.now();

  const projectInstructions = await loadProjectInstructions(projectPath);
  let systemContent = SYSTEM_PROMPT;
  if (projectInstructions) {
    systemContent += `\n\n---\n\n## Project-specific instructions (auto-loaded from ${projectInstructions.name})\n\n${projectInstructions.content}`;
  }

  const messages = [
    { role: 'system', content: systemContent },
    { role: 'user', content: prompt }
  ];

  const logLines = [];
  const write = (line) => {
    logLines.push(line);
    if (onProgress) onProgress(line);
  };

  write(`=== learn-mate agent session ===`);
  write(`started: ${new Date().toISOString()}`);
  write(`cwd:     ${projectPath}`);
  write(`model:   ${process.env.LEARN_MATE_MODEL || 'qwen-plus'} (override: LEARN_MATE_MODEL)`);
  write(`maxTurns:${maxTurns}`);
  write(`harness: ${projectInstructions ? `${projectInstructions.name} auto-loaded (${projectInstructions.content.length} chars)` : '(no AGENTS.md / CLAUDE.md — running bare)'}`);
  write('');
  write(`--- user prompt ---`);
  write(prompt);
  write('');

  let finishReason = 'max_turns';

  for (let turn = 1; turn <= maxTurns; turn++) {
    if (Date.now() - startWall > SOFT_WALL_CLOCK_MS) {
      write(`[turn ${turn}] ABORT wall-clock budget exceeded`);
      finishReason = 'wall_clock';
      break;
    }

    let raw;
    try {
      raw = await chatComplete({
        messages,
        responseFormat: { type: 'json_object' },
        temperature: 0.2,
        timeoutMs: 90000
      });
    } catch (e) {
      write(`[turn ${turn}] LLM call failed: ${e.message}`);
      finishReason = 'llm_error';
      break;
    }

    messages.push({ role: 'assistant', content: raw });

    let parsed;
    try {
      parsed = parseLooseJson(raw);
    } catch (e) {
      write(`[turn ${turn}] parse error: ${e.message}`);
      write(`  raw: ${raw.slice(0, 200)}`);
      // Feed parse error back; give the model one chance to recover.
      messages.push({
        role: 'user',
        content: `Your previous response was not valid JSON. Return exactly one JSON object matching the schema. Error: ${e.message}`
      });
      continue;
    }

    write(formatHeaderLine(turn, parsed));
    if (parsed.thought) write(`  thought: ${parsed.thought}`);

    const action = parsed.action;
    if (action === 'finish') {
      finishReason = `finish: ${parsed.args?.reason ?? '(no reason)'}`;
      break;
    }

    const tool = TOOLS[action];
    if (!tool) {
      write(`  -> unknown action: ${action}`);
      messages.push({
        role: 'user',
        content: `Unknown action "${action}". Use one of: list_dir, read_file, write_file, run_shell, finish.`
      });
      continue;
    }

    let result;
    try {
      result = await tool(projectPath, parsed.args ?? {});
    } catch (e) {
      result = { ok: false, error: e.message };
    }

    const toolLog = formatToolLog(action, result);
    if (toolLog) write(toolLog);

    messages.push({ role: 'user', content: formatToolResult(action, result) });
  }

  write('');
  write(`--- session end ---`);
  write(`turns:        ${Math.min(maxTurns, messages.filter((m) => m.role === 'assistant').length)}`);
  write(`wall_clock:   ${Math.round((Date.now() - startWall) / 1000)}s`);
  write(`exit_reason:  ${finishReason}`);

  const content = logLines.join('\n') + '\n';
  await fs.mkdir(path.dirname(logFile), { recursive: true });
  await fs.writeFile(logFile, content, 'utf8');

  return {
    logFile,
    turns: messages.filter((m) => m.role === 'assistant').length,
    wallClockMs: Date.now() - startWall,
    finishReason
  };
}
