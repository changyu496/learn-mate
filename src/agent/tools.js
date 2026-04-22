// Tool implementations for the built-in coding agent.
// Each tool returns a plain object `{ ok, ...summary }` that becomes part of
// the chat transcript fed back to the model.

import path from 'node:path';
import fs from 'node:fs/promises';
import { execSync } from 'node:child_process';

const READ_MAX = 8000;      // chars per read_file returned to the model
const SHELL_OUT_MAX = 4000; // chars per shell stdout/stderr kept

function safeRel(projectPath, rel) {
  const abs = path.resolve(projectPath, rel);
  if (!abs.startsWith(path.resolve(projectPath))) {
    throw new Error(`路径越界：${rel}`);
  }
  return abs;
}

function truncate(s, n) {
  if (s == null) return '';
  if (s.length <= n) return s;
  return s.slice(0, n) + `\n... [truncated ${s.length - n} chars]`;
}

export async function listDir(projectPath, args) {
  const rel = args?.path ?? '.';
  try {
    const abs = safeRel(projectPath, rel);
    const dirents = await fs.readdir(abs, { withFileTypes: true });
    const entries = dirents.map((d) => ({
      name: d.name,
      type: d.isDirectory() ? 'dir' : d.isFile() ? 'file' : 'other'
    }));
    return { ok: true, path: rel, entries };
  } catch (e) {
    return { ok: false, path: rel, error: e.message };
  }
}

export async function readFile(projectPath, args) {
  const rel = args?.path;
  if (!rel) return { ok: false, error: '缺少 path' };
  try {
    const abs = safeRel(projectPath, rel);
    const raw = await fs.readFile(abs, 'utf8');
    return {
      ok: true,
      path: rel,
      chars: raw.length,
      content: truncate(raw, READ_MAX),
      truncated: raw.length > READ_MAX
    };
  } catch (e) {
    return { ok: false, path: rel, error: e.message };
  }
}

export async function writeFile(projectPath, args) {
  const rel = args?.path;
  const content = args?.content ?? '';
  if (!rel) return { ok: false, error: '缺少 path' };
  try {
    const abs = safeRel(projectPath, rel);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, content, 'utf8');
    return { ok: true, path: rel, bytes: Buffer.byteLength(content, 'utf8') };
  } catch (e) {
    return { ok: false, path: rel, error: e.message };
  }
}

export function runShell(projectPath, args) {
  const cmd = args?.cmd;
  const timeoutSec = Math.min(Math.max(args?.timeoutSec ?? 120, 1), 300);
  if (!cmd) return { ok: false, error: '缺少 cmd' };

  const start = Date.now();
  try {
    const stdout = execSync(cmd, {
      cwd: projectPath,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: timeoutSec * 1000,
      maxBuffer: 10 * 1024 * 1024
    }).toString();
    return {
      ok: true,
      cmd,
      exitCode: 0,
      durationMs: Date.now() - start,
      stdout: truncate(stdout, SHELL_OUT_MAX),
      stderr: ''
    };
  } catch (e) {
    const durationMs = Date.now() - start;
    return {
      ok: false,
      cmd,
      exitCode: typeof e.status === 'number' ? e.status : -1,
      durationMs,
      stdout: truncate(e.stdout?.toString() ?? '', SHELL_OUT_MAX),
      stderr: truncate(e.stderr?.toString() ?? e.message, SHELL_OUT_MAX),
      timedOut: e.signal === 'SIGTERM' && durationMs >= timeoutSec * 1000 - 500
    };
  }
}

export const TOOLS = {
  list_dir:   listDir,
  read_file:  readFile,
  write_file: writeFile,
  run_shell:  runShell
};
