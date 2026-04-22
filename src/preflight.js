import { execSync } from 'node:child_process';

function checkCmd(name, cmd, versionRegex, severity = 'required') {
  try {
    const out = execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'] }).toString();
    const m = versionRegex ? out.match(versionRegex) : null;
    return { name, ok: true, version: m ? m[0] : undefined, severity };
  } catch {
    return { name, ok: false, severity };
  }
}

function checkEnv(name, vars, severity = 'optional') {
  const present = vars.find((v) => process.env[v]);
  return present
    ? { name, ok: true, version: `via ${present}`, severity }
    : { name, ok: false, severity, hint: `缺少 ${vars.join(' 或 ')}` };
}

export async function preflight() {
  return [
    checkCmd('Java', 'java -version 2>&1', /\d+\.\d+(\.\d+)?/),
    checkCmd('Maven', 'mvn -v', /Apache Maven [\d.]+/),
    checkEnv('LLM API Key', ['OPENAI_API_KEY', 'DASHSCOPE_API_KEY'])
  ];
}
