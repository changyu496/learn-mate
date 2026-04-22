import readline from 'node:readline/promises';
import chalk from 'chalk';

async function askChoice(rl, question) {
  console.log(chalk.bold(`\n${question.text}`));
  question.options.forEach((opt, i) => {
    console.log(`  ${i + 1}. ${opt.label}`);
  });
  while (true) {
    const raw = (await rl.question(chalk.cyan('> '))).trim();
    const n = Number.parseInt(raw, 10);
    if (Number.isInteger(n) && n >= 1 && n <= question.options.length) {
      return question.options[n - 1].value;
    }
    console.log(chalk.yellow(`请输入 1-${question.options.length} 之间的数字`));
  }
}

function computeDeadline(pace) {
  const daysMap = { weekend: 2, week: 7, twoweeks: 14 };
  const days = daysMap[pace];
  if (days == null) return null;
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function summarizePath(profile) {
  const notes = [];
  if (profile['agent-exp'] === 'never') {
    notes.push('你还没用过 coding agent，建议在 step-0 多花点时间，把基本操作先跑顺。');
  }
  if (profile['agents-md'] === 'wrote') {
    notes.push('你写过 AGENTS.md，step-1 会简化讲解，重点验收"五要素是否真的齐全"。');
  } else if (profile['agents-md'] === 'unknown') {
    notes.push('你没听过 AGENTS.md，step-1 会完整展开讲解。');
  }
  if (profile.goal === 'project') {
    notes.push('你带着真实项目问题来的，step-4 的对照实验建议用你自己的项目也跑一遍。');
  }
  if (notes.length === 0) {
    notes.push('按默认节奏走完 5 步，预计 2-3 小时。');
  }
  return notes;
}

export async function runOnboarding(course) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    console.log(chalk.cyan(`\n━━━ ${course.title} ━━━\n`));
    console.log(course.intro);
    console.log();
    console.log(chalk.gray(`本课程共 ${course.steps.length} 步：`));
    course.steps.forEach((s, i) => {
      console.log(chalk.gray(`  ${i + 1}. ${s.title}`));
    });

    console.log(chalk.cyan('\n接下来问你 4 个问题，用来个性化你的学习路径。'));

    const profile = {};
    for (const q of course.backgroundQuestions) {
      profile[q.id] = await askChoice(rl, q);
    }

    const deadline = computeDeadline(profile.pace);
    const goals = {
      reason: profile.goal,
      pace: profile.pace,
      deadline
    };

    const notes = summarizePath(profile);

    console.log(chalk.cyan('\n━━━ 为你定制的学习建议 ━━━\n'));
    for (const line of notes) console.log(`  • ${line}`);
    if (deadline) {
      console.log(chalk.yellow(`\n你承诺在 ${deadline} 前完成。每次 start 我会提醒你剩余天数。`));
    } else {
      console.log(chalk.gray('\n你选择了灵活节奏，不设截止日期。'));
    }

    return { profile, goals, pathOverrides: { notes } };
  } finally {
    rl.close();
  }
}
