#!/usr/bin/env node

import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs';
import { MemoryStore } from '../memory/store.js';
import { LLMClient } from '../llm/client.js';
import { Course } from '../curriculum/course.js';
import { Learner } from '../agent/learner.js';

const HOME_DIR = process.env.HOME || process.env.USERPROFILE || '.';
const DATA_DIR = path.join(HOME_DIR, '.learn-mate', 'data');
const DB_PATH = path.join(DATA_DIR, 'learn-mate.db');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const store = new MemoryStore(DB_PATH);
const course = new Course(
  path.join(__dirname, '../../../reference/learn-harness-engineering/docs/zh/lectures')
);

let isInitialized = false;

async function ensureInitialized(): Promise<void> {
  if (!isInitialized) {
    await course.initialize();
    isInitialized = true;
  }
}

function getLLMClient(): LLMClient {
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) {
    throw new Error('MINIMAX_API_KEY environment variable is not set');
  }
  return new LLMClient({ apiKey });
}

function getLearner(userId: string): Learner {
  return new Learner(store, getLLMClient(), course);
}

const program = new Command();

program
  .name('learn-mate')
  .description('AI private tutor - learn anything with mastery')
  .version('0.1.0');

program
  .command('start')
  .description('Start a new learning session')
  .action(async () => {
    try {
      await ensureInitialized();
      const learner = getLearner('default-user');

      if (!store.getUser('default-user')) {
        store.createUser('default-user', 'Learner');
      }

      console.log('\n🎓 Welcome to LearnMate!\n');
      const onboarding = await learner.startOnboarding('default-user');
      console.log(onboarding.message);
      console.log('\n---');
      console.log('To set your preferences, run:');
      console.log('  learn-mate plan --set\n');
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('continue')
  .description('Continue learning from where you left off')
  .action(async () => {
    try {
      await ensureInitialized();
      const learner = getLearner('default-user');
      const progress = await learner.getProgress('default-user');

      if (progress.completed === progress.total) {
        console.log('\n🎉 Congratulations! You have completed the course!\n');
        return;
      }

      const nextLecture = await learner.getNextLecture('default-user');
      if (nextLecture) {
        console.log(`\n📚 Next lecture: ${nextLecture}\n`);
        const teaching = await learner.teachLecture('default-user', nextLecture);
        console.log(`## ${teaching.title}\n`);
        console.log(teaching.content);
        console.log('\n--- Quiz ---\n');
        console.log(teaching.quiz.question);
        if (teaching.quiz.options) {
          teaching.quiz.options.forEach(opt => console.log(`  ${opt}`));
        }
        console.log('\n(Answer with learn-mate answer --lecture ' + teaching.lectureId + ' --answer <A/B/C/D>)\n');
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('progress')
  .description('View your learning progress')
  .action(async () => {
    try {
      await ensureInitialized();
      const learner = getLearner('default-user');
      const progress = await learner.getProgress('default-user');

      console.log('\n📊 Learning Progress\n');
      console.log(`Completed: ${progress.completed}/${progress.total} lectures`);
      console.log(`Progress: ${Math.round((progress.completed / progress.total) * 100)}%`);
      console.log(`Current: ${progress.currentLecture || 'None'}`);

      if (progress.weakTopics.length > 0) {
        console.log(`\n⚠️ Topics to review: ${progress.weakTopics.join(', ')}`);
      }
      console.log();
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('status')
  .description('View current learning status')
  .action(async () => {
    try {
      await ensureInitialized();
      const learner = getLearner('default-user');
      const progress = await learner.getProgress('default-user');
      const plan = store.getPlanByUser('default-user');

      console.log('\n📍 Current Status\n');
      console.log(`Completed: ${progress.completed}/${progress.total}`);
      console.log(`Daily goal: ${plan?.dailyGoal || 1} lecture(s)/day`);
      console.log(`Reminder: ${plan?.reminderTime || 'Not set'}`);
      console.log();
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

const planCmd = program.command('plan');

planCmd
  .command('show')
  .description('Show current learning plan')
  .action(() => {
    const plan = store.getPlanByUser('default-user');
    console.log('\n📋 Learning Plan\n');
    if (plan) {
      console.log(`Daily goal: ${plan.dailyGoal} lecture(s)`);
      console.log(`Target days: ${plan.targetDays}`);
      console.log(`Start date: ${plan.startDate}`);
      console.log(`Reminder time: ${plan.reminderTime || 'Not set'}`);
    } else {
      console.log('No plan set. Run: learn-mate plan --set');
    }
    console.log();
  });

planCmd
  .command('set')
  .description('Set learning preferences')
  .option('--daily <number>', 'Daily lectures goal', '1')
  .option('--days <number>', 'Target days to complete', '14')
  .option('--time <HH:MM>', 'Reminder time', '20:00')
  .action(async (options) => {
    try {
      await ensureInitialized();
      const learner = getLearner('default-user');
      await learner.setLearningPreferences('default-user', {
        level: 'beginner',
        dailyCapacity: parseInt(options.daily || '1'),
        targetDays: parseInt(options.days || '14'),
        language: 'python'
      });

      store.createPlan('default-user', {
        dailyGoal: parseInt(options.daily || '1'),
        targetDays: parseInt(options.days || '14'),
        reminderTime: options.time || '20:00'
      });

      console.log('\n✅ Learning plan set!\n');
      console.log(`Daily goal: ${options.daily || 1} lecture(s)`);
      console.log(`Target: ${options.days || 14} days`);
      console.log(`Reminder: ${options.time || '20:00'}\n`);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('answer')
  .description('Submit an answer to the current quiz')
  .requiredOption('--lecture <id>', 'Lecture ID')
  .requiredOption('--answer <A|B|C|D>', 'Your answer')
  .action(async (options) => {
    try {
      await ensureInitialized();
      const learner = getLearner('default-user');
      const isCorrect = false; // Would need actual quiz logic

      const result = await learner.checkAnswer('default-user', options.lecture, {
        selectedAnswer: options.answer,
        isCorrect
      });

      if (result.correct) {
        console.log('\n✅ Correct! Well done!\n');
      } else {
        console.log('\n❌ Not quite right.\n');
        if (result.diagnosis) {
          console.log(`💡 ${result.diagnosis}\n`);
        }
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('reset')
  .description('Reset all learning progress')
  .action(() => {
    console.log('\n⚠️ This will reset all your progress. Are you sure? (y/N)\n');
    // In real CLI, would prompt for confirmation
    console.log('Run with --confirm to skip confirmation.\n');
  });

program.parse();