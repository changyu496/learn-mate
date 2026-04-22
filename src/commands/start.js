import chalk from 'chalk';
import { readProgress, appendEvent, daysUntil } from '../progress.js';
import { loadCourse, findStep, loadTeaching } from '../course.js';

function renderDeadline(goals) {
  if (!goals?.deadline) return null;
  const days = daysUntil(goals.deadline);
  if (days == null) return null;
  if (days < 0) return chalk.red(`  ⏰ 已过承诺日期 ${goals.deadline}（逾期 ${-days} 天）`);
  if (days === 0) return chalk.yellow(`  ⏰ 今天是你承诺的截止日 ${goals.deadline}`);
  return chalk.yellow(`  ⏰ 距离承诺日期 ${goals.deadline} 还剩 ${days} 天`);
}

export async function startCommand() {
  const progress = await readProgress();
  if (!progress) {
    console.log(chalk.yellow('未找到进度文件。先在目标目录运行：learn-mate init <path>'));
    process.exitCode = 1;
    return;
  }

  const course = await loadCourse(progress.courseId);
  const step = findStep(course, progress.currentStepId);

  if (!step) {
    console.log(chalk.green('🎉 所有步骤都完成了'));
    return;
  }

  console.log(chalk.cyan(`\n▶ ${course.title}`));
  const dl = renderDeadline(progress.goals);
  if (dl) console.log(dl);
  console.log(chalk.bold(`  ${step.id}：${step.title}`));
  console.log(chalk.gray(`  ${step.goal}\n`));

  await appendEvent(process.cwd(), { type: 'step_start', stepId: step.id });

  const teaching = await loadTeaching(step);
  if (teaching) {
    console.log(chalk.white(teaching));
  } else {
    console.log(chalk.yellow('（此步骤的教学内容缺失）'));
  }

  console.log(chalk.gray('\n────────────────────────────────────────'));
  const deliverables = (step.deliverables ?? []).join(', ');
  if (deliverables) {
    console.log(chalk.cyan(`📝 交付物：${deliverables}`));
  }
  console.log(chalk.cyan('✓ 完成后运行：learn-mate check'));
}
