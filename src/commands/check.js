import chalk from 'chalk';
import { readProgress, writeProgress, appendEvent } from '../progress.js';
import { loadCourse, findStep } from '../course.js';
import { runRules } from '../check/rules.js';
import { runLlmChecks } from '../check/judge.js';

function printItem(item) {
  const ok = item.ok ?? item.covered ?? item.specific ?? item.concrete;
  const icon = ok ? chalk.green('•') : chalk.red('•');
  const label = item.name || item.id || item.mode || item.diff || '?';
  const note = item.note || item.suggestion || item.evidence || item.reason || '';
  console.log(`     ${icon} ${label}${note ? chalk.gray(' — ' + note) : ''}`);
}

export async function checkCommand() {
  const progress = await readProgress();
  if (!progress) {
    console.log(chalk.yellow('未找到进度文件。先运行：learn-mate init <path>'));
    process.exitCode = 1;
    return;
  }

  const course = await loadCourse(progress.courseId);
  const step = findStep(course, progress.currentStepId);
  if (!step) {
    console.log(chalk.green('🎉 所有步骤已完成'));
    return;
  }

  console.log(chalk.cyan(`\n验收 ${step.id}：${step.title}\n`));

  // Phase 1: 规则判
  console.log(chalk.bold('规则检查'));
  const ruleResults = await runRules(step.rubric?.rules ?? [], process.cwd());
  for (const r of ruleResults) {
    const icon = r.ok ? chalk.green('✓') : chalk.red('✗');
    console.log(`  ${icon} ${r.label}${r.detail ? chalk.gray(' — ' + r.detail) : ''}`);
  }
  const rulesPassed = ruleResults.every((r) => r.ok);
  if (!rulesPassed) {
    console.log(chalk.yellow('\n规则未全通过，修复后重试 `learn-mate check`。'));
    await appendEvent(process.cwd(), { type: 'check_failed', stepId: step.id, phase: 'rules' });
    process.exitCode = 1;
    return;
  }

  // Phase 2: LLM 判官
  const llmChecks = step.rubric?.llmChecks ?? [];
  let llmPassed = true;
  if (llmChecks.length > 0) {
    console.log(chalk.bold('\nLLM 判官'));
    if (!(process.env.OPENAI_API_KEY || process.env.DASHSCOPE_API_KEY)) {
      console.log(chalk.red('  ✗ 未设置 OPENAI_API_KEY（或 DASHSCOPE_API_KEY），无法调用 LLM'));
      console.log(chalk.gray('    export OPENAI_API_KEY=<your-key>'));
      console.log(chalk.gray('    export OPENAI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1'));
      process.exitCode = 1;
      return;
    }

    console.log(chalk.gray('  （调用 LLM 中，请稍候…）'));
    const llmResults = await runLlmChecks(llmChecks, process.cwd());
    for (const r of llmResults) {
      const icon = r.ok ? chalk.green('✓') : chalk.red('✗');
      console.log(`  ${icon} ${r.description}`);
      if (r.detail) console.log(chalk.gray(`     ${r.detail}`));
      if (r.parsed?.feedback) console.log(chalk.gray(`     ${r.parsed.feedback}`));
      if (Array.isArray(r.parsed?.items)) {
        for (const item of r.parsed.items) printItem(item);
      }
    }
    llmPassed = llmResults.every((r) => r.ok);
    if (!llmPassed) {
      console.log(chalk.yellow('\nLLM 验收未通过，按反馈修改后重试 `learn-mate check`。'));
      await appendEvent(process.cwd(), { type: 'check_failed', stepId: step.id, phase: 'llm' });
      process.exitCode = 1;
      return;
    }
  }

  // 全部通过 → 推进
  const idx = course.steps.findIndex((s) => s.id === step.id);
  const next = course.steps[idx + 1] ?? null;
  progress.completedSteps.push(step.id);
  progress.currentStepId = next ? next.id : null;
  await writeProgress(process.cwd(), progress);
  await appendEvent(process.cwd(), { type: 'step_complete', stepId: step.id });

  console.log(chalk.green(`\n🎉 ${step.id} 通过！`));
  if (next) {
    console.log(chalk.cyan(`下一步：${next.id} · ${next.title}`));
    console.log(chalk.gray('运行：learn-mate start'));
  } else {
    console.log(chalk.cyan('所有步骤完成！'));
  }
}
