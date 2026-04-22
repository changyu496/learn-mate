import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');

export async function loadCourse(id) {
  const file = path.join(DATA_DIR, `${id}.json`);
  const raw = await fs.readFile(file, 'utf8');
  return JSON.parse(raw);
}

export function findStep(course, stepId) {
  return course.steps.find((s) => s.id === stepId);
}

export async function loadTeaching(step) {
  if (!step?.teachingFile) return null;
  const file = path.join(DATA_DIR, step.teachingFile);
  try {
    return await fs.readFile(file, 'utf8');
  } catch {
    return null;
  }
}
