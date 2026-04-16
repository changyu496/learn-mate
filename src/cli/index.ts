#!/usr/bin/env node

import * as path from 'path';
import * as fs from 'fs';
import * as readline from 'readline';
import { MemoryStore } from '../memory/store.js';
import { LLMClient } from '../llm/client.js';
import { Course } from '../curriculum/course.js';
import { Learner } from '../agent/learner.js';
import type { QuestionOption } from '../agent/questionGenerator.js';

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

// 显示选项列表
function displayOptions(options: QuestionOption[]): void {
  console.log('\n请选择：\n');
  options.forEach((opt, i) => {
    console.log(`  ${i + 1}. ${opt.label}`);
    if (opt.description) {
      console.log(`     ${opt.description}`);
    }
  });
  console.log();
}

// 解析用户选择
function parseChoice(userInput: string, options: QuestionOption[]): QuestionOption | null {
  // 先尝试匹配数字
  const num = parseInt(userInput.trim(), 10);
  if (!isNaN(num) && num >= 1 && num <= options.length) {
    return options[num - 1];
  }

  // 尝试匹配选项值
  const lowerInput = userInput.toLowerCase().trim();
  for (const opt of options) {
    if (
      opt.label.toLowerCase().includes(lowerInput) ||
      opt.value.toLowerCase().includes(lowerInput)
    ) {
      return opt;
    }
  }

  // 没找到匹配，返回 null
  return null;
}

// 显示消息
function displayMessage(message: string): void {
  console.log('\nTutor:', message);
}

async function interactiveSession(): Promise<void> {
  await ensureInitialized();

  const rl = createInterface();
  const llmClient = getLLMClient();
  const learner = new Learner(store, llmClient, course);
  const userId = 'default-user';

  console.log('\n=== LearnMate - Your AI Tutor ===\n');
  console.log('输入选项数字或文字选择，或直接输入内容与我对话。输入 "quit" 退出。\n');

  // Start conversation
  let response = await learner.startConversation(userId);
  displayMessage(response.message);

  // Options mode state
  let inOptionsMode = false;
  let currentOptions: QuestionOption[] = [];

  // Main loop
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
      // 如果在选项模式
      if (inOptionsMode && currentOptions.length > 0) {
        const choice = parseChoice(userInput, currentOptions);

        if (choice) {
          // 执行用户选择
          response = await learner.executeChoice(userId, choice.value);
        } else {
          // 用户输入无法识别，当作对话处理
          response = await learner.respond(userId, store.getTeachingState(userId)?.lectureId || '', userInput);
        }
      } else {
        // 正常对话模式
        response = await learner.respond(userId, store.getTeachingState(userId)?.lectureId || '', userInput);
      }

      // 处理响应
      if (response.type === 'options' && response.options && response.options.length > 0) {
        // 进入选项模式
        inOptionsMode = true;
        currentOptions = response.options;
        displayMessage(response.message);
        displayOptions(currentOptions);
      } else if (response.type === 'continue') {
        // 检查是否准备好开始学习
        const readyKeywords = ['准备好了', '开始学习', '开始吧', 'ready', 'start'];
        const isReady = readyKeywords.some(k => userInput.toLowerCase().includes(k.toLowerCase()));

        if (isReady) {
          // 开始学习
          const lectureId = await learner.getNextLecture(userId);
          if (lectureId) {
            response = await learner.teach(userId, lectureId);
            if (response.type === 'options' && response.options) {
              inOptionsMode = true;
              currentOptions = response.options;
              displayMessage(response.message);
              displayOptions(currentOptions);
            } else {
              displayMessage(response.message);
              inOptionsMode = false;
              currentOptions = [];
            }
            continue;
          }
        }

        // 显示继续消息
        displayMessage(response.message);
        inOptionsMode = false;
        currentOptions = [];
      } else {
        // 普通消息
        displayMessage(response.message);
        inOptionsMode = false;
        currentOptions = [];
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('\nError:', message);

      if (message.includes('API error')) {
        console.log('\nAPI seems busy. Please try again or type "quit" to exit.\n');
      }
    }
  }

  rl.close();
}

// Run
interactiveSession().catch((error) => {
  console.error('Fatal Error:', error instanceof Error ? error.message : error);
  process.exit(1);
});
