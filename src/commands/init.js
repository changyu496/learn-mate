import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import chalk from 'chalk';
import { preflight } from '../preflight.js';
import { initProgress, progressFile } from '../progress.js';
import { loadCourse } from '../course.js';
import { runOnboarding } from '../onboarding.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = path.join(__dirname, '..', '..', 'templates');

const DEFAULT_COURSE_ID = 'harness-engineering';

async function copyTemplate(templateId, dest) {
  const src = path.join(TEMPLATES_DIR, templateId);
  try {
    await fs.access(src);
  } catch {
    throw new Error(`模板不存在：${src}`);
  }
  await fs.cp(src, dest, { recursive: true, force: true });
}

export async function initCommand(targetPath) {
  const abs = path.resolve(targetPath);
  console.log(chalk.cyan(`初始化学习项目：${abs}\n`));

  const checks = await preflight();
  for (const c of checks) {
    const ver = c.version ? chalk.gray(` (${c.version})`) : '';
    if (c.ok) {
      console.log(`  ${chalk.green('✓')} ${c.name}${ver}`);
    } else if (c.severity === 'optional') {
      console.log(`  ${chalk.yellow('!')} ${c.name}${chalk.gray(' — ' + (c.hint ?? '未设置'))} ${chalk.gray('(check 命令时需要)')}`);
    } else {
      console.log(`  ${chalk.red('✗')} ${c.name}`);
    }
  }
  const hardFail = checks.some((c) => !c.ok && c.severity !== 'optional');
  if (hardFail) {
    console.log(chalk.yellow('\n环境检查未通过，请先安装缺失的依赖后重试。'));
    process.exitCode = 1;
    return;
  }

  const course = await loadCourse(DEFAULT_COURSE_ID);
  const onboarding = await runOnboarding(course);

  await fs.mkdir(abs, { recursive: true });
  if (course.templateId) {
    await copyTemplate(course.templateId, abs);
    console.log(chalk.gray(`\n  已复制模板：${course.templateId}`));
  }

  await initProgress(abs, course, onboarding);

  console.log(chalk.green('\n✓ 初始化完成'));
  console.log(chalk.gray(`  进度文件：${progressFile(abs)}`));
  console.log(chalk.cyan(`\n下一步：cd ${targetPath} && learn-mate start`));
}
