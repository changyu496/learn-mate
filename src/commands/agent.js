import path from 'node:path';
import chalk from 'chalk';
import { readProgress, appendEvent } from '../progress.js';
import { loadCourse, findStep } from '../course.js';
import { runAgent } from '../agent/loop.js';

export async function agentCommand() {
  const progress = await readProgress();
  if (!progress) {
    console.log(chalk.yellow('未找到进度文件。先运行：learn-mate init <path>'));
    process.exitCode = 1;
    return;
  }

  const course = await loadCourse(progress.courseId);
  const step = findStep(course, progress.currentStepId);
  if (!step) {
    console.log(chalk.green('🎉 所有步骤已完成，没有可执行的 agent 任务'));
    return;
  }

  if (!step.agentPrompt || !step.agentLogFile) {
    console.log(chalk.yellow(`当前步骤 ${step.id} 不需要内置 agent，按 teaching 说明手动完成。`));
    console.log(chalk.gray('运行：learn-mate start 查看指引'));
    return;
  }

  if (!(process.env.OPENAI_API_KEY || process.env.DASHSCOPE_API_KEY)) {
    console.log(chalk.red('✗ 未设置 OPENAI_API_KEY（或 DASHSCOPE_API_KEY），无法运行内置 agent'));
    console.log(chalk.gray('  export OPENAI_API_KEY=<your-key>'));
    console.log(chalk.gray('  export OPENAI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1'));
    process.exitCode = 1;
    return;
  }

  const logFile = path.join(process.cwd(), step.agentLogFile);

  console.log(chalk.cyan(`\n▶ 内置 agent 启动中：${step.id} · ${step.title}`));
  console.log(chalk.gray(`  prompt:  ${step.agentPrompt.slice(0, 120)}${step.agentPrompt.length > 120 ? '…' : ''}`));
  console.log(chalk.gray(`  log →    ${step.agentLogFile}`));
  console.log(chalk.gray(`  模型:    ${process.env.LEARN_MATE_MODEL || 'qwen-plus'}`));
  console.log('');

  await appendEvent(process.cwd(), { type: 'agent_start', stepId: step.id });

  let summary;
  try {
    summary = await runAgent({
      prompt: step.agentPrompt,
      projectPath: process.cwd(),
      logFile,
      maxTurns: step.agentMaxTurns ?? 20,
      onProgress: (line) => {
        if (line.startsWith('[turn ')) console.log(chalk.dim(line));
      }
    });
  } catch (e) {
    console.log(chalk.red(`\n✗ agent 异常退出：${e.message}`));
    await appendEvent(process.cwd(), { type: 'agent_error', stepId: step.id, error: e.message });
    process.exitCode = 1;
    return;
  }

  await appendEvent(process.cwd(), {
    type: 'agent_end',
    stepId: step.id,
    turns: summary.turns,
    wallClockMs: summary.wallClockMs,
    finishReason: summary.finishReason
  });

  console.log('');
  console.log(chalk.green(`✓ agent 结束`));
  console.log(chalk.gray(`  turns:       ${summary.turns}`));
  console.log(chalk.gray(`  wall clock:  ${Math.round(summary.wallClockMs / 1000)}s`));
  console.log(chalk.gray(`  exit reason: ${summary.finishReason}`));
  console.log(chalk.cyan(`\n日志已写入：${step.agentLogFile}`));
  console.log(chalk.cyan(`下一步：先看看 log 里 agent 翻车 / 成功的地方，然后运行 learn-mate check`));
}
