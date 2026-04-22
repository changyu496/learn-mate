import path from 'node:path';
import fs from 'node:fs/promises';
import { execSync } from 'node:child_process';

function describe(rule) {
  switch (rule.type) {
    case 'file_exists':   return `文件存在：${rule.path}`;
    case 'min_chars':     return `长度 ≥ ${rule.minChars} 字符：${rule.path}`;
    case 'min_lines':     return `行数 ≥ ${rule.minLines}：${rule.path}`;
    case 'has_shebang':   return `有 shebang：${rule.path}`;
    case 'exec_exit_zero':return `执行 \`${rule.cmd}\` 退出码 0`;
    case 'valid_json':    return `合法 JSON：${rule.path}`;
    case 'json_shape':    return `JSON 结构检查：${rule.path}`;
    default:              return `未知规则：${rule.type}`;
  }
}

async function readText(projectPath, relPath) {
  return fs.readFile(path.join(projectPath, relPath), 'utf8');
}

async function runRule(rule, projectPath) {
  const label = describe(rule);
  try {
    switch (rule.type) {
      case 'file_exists': {
        await fs.access(path.join(projectPath, rule.path));
        return { label, ok: true };
      }
      case 'min_chars': {
        const text = await readText(projectPath, rule.path);
        const n = text.length;
        return n >= rule.minChars
          ? { label, ok: true, detail: `${n} 字符` }
          : { label, ok: false, detail: `仅 ${n} 字符` };
      }
      case 'min_lines': {
        const text = await readText(projectPath, rule.path);
        const n = text.split('\n').length;
        return n >= rule.minLines
          ? { label, ok: true, detail: `${n} 行` }
          : { label, ok: false, detail: `仅 ${n} 行` };
      }
      case 'has_shebang': {
        const text = await readText(projectPath, rule.path);
        const first = text.split('\n')[0] ?? '';
        return first.startsWith('#!')
          ? { label, ok: true }
          : { label, ok: false, detail: '首行不是 #!' };
      }
      case 'exec_exit_zero': {
        const timeoutMs = (rule.timeoutSec ?? 60) * 1000;
        execSync(rule.cmd, { cwd: projectPath, stdio: 'pipe', timeout: timeoutMs });
        return { label, ok: true, detail: '退出码 0' };
      }
      case 'valid_json': {
        const text = await readText(projectPath, rule.path);
        JSON.parse(text);
        return { label, ok: true };
      }
      case 'json_shape': {
        const text = await readText(projectPath, rule.path);
        const data = JSON.parse(text);
        const req = rule.requires || {};
        const arr = req.arrayPath ? data?.[req.arrayPath] : data;
        if (!Array.isArray(arr)) {
          return { label, ok: false, detail: `期望 ${req.arrayPath ?? '根'} 是数组` };
        }
        if (req.minItems != null && arr.length < req.minItems) {
          return { label, ok: false, detail: `数组长度 ${arr.length} < ${req.minItems}` };
        }
        if (Array.isArray(req.itemFields)) {
          for (let i = 0; i < arr.length; i++) {
            for (const f of req.itemFields) {
              if (arr[i] == null || !(f in arr[i])) {
                return { label, ok: false, detail: `第 ${i} 项缺字段 ${f}` };
              }
            }
          }
        }
        return { label, ok: true, detail: `${arr.length} 项` };
      }
      default:
        return { label, ok: false, detail: '未知规则类型' };
    }
  } catch (e) {
    const msg = (e && e.message) ? e.message.split('\n')[0] : String(e);
    return { label, ok: false, detail: msg.slice(0, 200) };
  }
}

export async function runRules(rules, projectPath) {
  const out = [];
  for (const rule of rules || []) {
    out.push(await runRule(rule, projectPath));
  }
  return out;
}
