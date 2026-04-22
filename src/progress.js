import path from 'node:path';
import fs from 'node:fs/promises';

const PROGRESS_FILE = '.learn-mate/progress.json';

export function progressDir(projectPath = process.cwd()) {
  return path.join(projectPath, '.learn-mate');
}

export function progressFile(projectPath = process.cwd()) {
  return path.join(projectPath, PROGRESS_FILE);
}

export async function initProgress(projectPath, course, onboarding = {}) {
  await fs.mkdir(progressDir(projectPath), { recursive: true });
  const data = {
    courseId: course.id,
    currentStepId: course.steps[0].id,
    startedAt: new Date().toISOString(),
    profile: onboarding.profile ?? {},
    goals: onboarding.goals ?? { reason: null, pace: null, deadline: null },
    pathOverrides: onboarding.pathOverrides ?? { notes: [] },
    completedSteps: [],
    events: []
  };
  await fs.writeFile(progressFile(projectPath), JSON.stringify(data, null, 2));
  return data;
}

export function daysUntil(deadline) {
  if (!deadline) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(`${deadline}T00:00:00`);
  return Math.round((end - today) / (1000 * 60 * 60 * 24));
}

export async function readProgress(projectPath = process.cwd()) {
  try {
    const raw = await fs.readFile(progressFile(projectPath), 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function writeProgress(projectPath, data) {
  await fs.writeFile(progressFile(projectPath), JSON.stringify(data, null, 2));
}

export async function appendEvent(projectPath, event) {
  const p = await readProgress(projectPath);
  if (!p) return;
  p.events.push({ at: new Date().toISOString(), ...event });
  await writeProgress(projectPath, p);
}
