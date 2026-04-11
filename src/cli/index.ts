#!/usr/bin/env node

import * as path from 'path';
import * as fs from 'fs';
import * as readline from 'readline';
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

function createInterface(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

async function askQuestion(rl: readline.Interface, prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer);
    });
  });
}

async function interactiveSession(): Promise<void> {
  await ensureInitialized();

  const rl = createInterface();
  const llmClient = getLLMClient();
  const learner = new Learner(store, llmClient, course);
  const userId = 'default-user';

  console.log('\n=== LearnMate - Your AI Tutor ===\n');
  console.log('Type your responses to chat with me. Type "quit" to exit.\n');

  // Start conversation
  let response = await learner.startConversation(userId);
  console.log(response.message);
  console.log();

  // Onboarding loop
  let inOnboarding = true;
  let inLearning = false;
  let currentLectureId: string | null = null;

  while (true) {
    const userInput = await askQuestion(rl, '\nYou: ');

    if (userInput.toLowerCase() === 'quit') {
      console.log('\nBye!\n');
      break;
    }

    if (!userInput.trim()) {
      continue;
    }

    try {
      if (inOnboarding) {
        response = await learner.continueOnboarding(userId, userInput);
        console.log('\nTutor:', response.message);

        if (response.type === 'continue') {
          inOnboarding = false;
          inLearning = true;

          currentLectureId = await learner.getNextLecture(userId);
          if (currentLectureId) {
            response = await learner.teach(userId, currentLectureId);
            console.log('\nTutor:', response.message);
          }
        }
      } else if (inLearning && currentLectureId) {
        response = await learner.respond(userId, currentLectureId, userInput);
        console.log('\nTutor:', response.message);

        if (response.type === 'continue' || response.message.includes('next')) {
          const nextLecture = await learner.getNextLecture(userId);
          if (nextLecture && nextLecture !== currentLectureId) {
            currentLectureId = nextLecture;
            response = await learner.teach(userId, currentLectureId);
            console.log('\nTutor:', response.message);
          } else {
            console.log('\n=== Congratulations! Course Complete! ===\n');
            const progress = await learner.getProgress(userId);
            console.log('Progress: ' + progress.completed + '/' + progress.total + ' lectures mastered\n');
            break;
          }
        }
      }
    } catch (error) {
      console.error('\nError:', error instanceof Error ? error.message : error);
    }
  }

  rl.close();
}

// Run
interactiveSession().catch((error) => {
  console.error('Fatal Error:', error instanceof Error ? error.message : error);
  process.exit(1);
});
