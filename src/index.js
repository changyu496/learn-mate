import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { startCommand } from './commands/start.js';
import { statusCommand } from './commands/status.js';
import { checkCommand } from './commands/check.js';
import { agentCommand } from './commands/agent.js';

const program = new Command();

program
  .name('learn-mate')
  .description('让 AI 带你真正学会，而不是收藏后吃灰')
  .version('0.0.1');

program
  .command('init <path>')
  .description('初始化学习项目：preflight + 模板复制 + 进度初始化')
  .action(initCommand);

program
  .command('start')
  .description('开始或继续当前学习步骤（在已 init 的项目目录中运行）')
  .action(startCommand);

program
  .command('status')
  .description('查看学习进度')
  .action(statusCommand);

program
  .command('check')
  .description('验收当前步骤（规则判 + LLM 判官），通过则推进到下一步')
  .action(checkCommand);

program
  .command('agent')
  .description('运行内置 agent（仅部分步骤需要，例如 step-0/step-4 的裸 prompt 跑测）')
  .action(agentCommand);

program.parseAsync().catch((err) => {
  console.error(err);
  process.exit(1);
});
