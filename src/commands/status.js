import chalk from 'chalk';
import { readProgress, daysUntil } from '../progress.js';
import { loadCourse, findStep } from '../course.js';

export async function statusCommand() {
  const progress = await readProgress();
  if (!progress) {
    console.log(chalk.yellow('未找到进度文件。先在目标目录运行：learn-mate init <path>'));
    process.exitCode = 1;
    return;
  }

  const course = await loadCourse(progress.courseId);
  const step = findStep(course, progress.currentStepId);

  console.log(chalk.cyan(`课程：${course.title}`));
  console.log(`  开始于：${progress.startedAt}`);
  console.log(`  当前：${step ? `${step.id} · ${step.title}` : chalk.green('全部完成 🎉')}`);
  console.log(`  已完成：${progress.completedSteps.length} / ${course.steps.length}`);

  if (progress.goals?.deadline) {
    const days = daysUntil(progress.goals.deadline);
    if (days == null) {
      // no-op
    } else if (days < 0) {
      console.log(chalk.red(`  截止：${progress.goals.deadline}（逾期 ${-days} 天）`));
    } else {
      console.log(chalk.yellow(`  截止：${progress.goals.deadline}（还剩 ${days} 天）`));
    }
  }

  if (progress.pathOverrides?.notes?.length) {
    console.log(chalk.gray('\n  个性化建议：'));
    for (const n of progress.pathOverrides.notes) {
      console.log(chalk.gray(`    • ${n}`));
    }
  }

  if (progress.events?.length) {
    const last = progress.events[progress.events.length - 1];
    console.log(chalk.gray(`\n  最近事件：${last.type} @ ${last.at}`));
  }
}
