# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**LearnMate** is an AI personal tutor CLI that teaches **Harness Engineering** (building reliable execution environments for AI agents). The core insight: it's NOT a course executor, but a conversational AI tutor that understands course content and teaches in the most suitable way for each user.

### Product Vision

- Not filling users with course content, but **Agent understands course then teaches in the way that fits you best**
- Long-term: a virtual person that interacts via text, voice, video; knows you, remembers you, grows with you
- Current MVP: text-based tutor with options-based interaction

### Core Principles

1. **Mastery Learning** - Must demonstrate understanding before advancing (Mastery Gate)
2. **Options-Based Interaction** - Use multiple-choice questions to guide user thinking (scaffolding)
3. **Personalization** - Adjust explanation depth based on user level, preferences
4. **Memory** - Remember users, grow with them, understand them better over time

### Education Theory Behind the Design

Based on Claude Code's teach-me skill and pedagogy research:

- **Testing Effect** - Self-testing is more effective than repeated reading
- **Generation Effect** - Answers you generate yourself stick better than passive reception
- **Bloom's Taxonomy** - Remember → Understand → Apply → Analyze → Evaluate → Create
- **AskUserQuestion Pattern** - Options serve as thinking scaffolds, not just convenience

## Commands

```bash
npm run build   # Compile TypeScript to dist/
npm run dev     # Run TypeScript source directly with tsx
npm run start   # Run compiled application
npx vitest      # Run tests (Vitest)
```

**Environment variable required:** `MINIMAX_API_KEY`

**Engine:** Node.js >= 22.0.0

## Architecture

### Core Components

| Component | File | Responsibility |
|-----------|------|----------------|
| `Learner` | `src/agent/learner.ts` | AI tutor logic - onboarding, teaching, three-layer verification |
| `QuestionGenerator` | `src/agent/questionGenerator.ts` | LLM-generated multiple-choice questions (teach-me pattern) |
| `LLMClient` | `src/llm/client.ts` | MiniMax API wrapper with 5 retries and exponential backoff |
| `MemoryStore` | `src/memory/store.ts` | SQLite persistence for users, profiles, conversations, TeachingState |
| `Course` | `src/curriculum/course.ts` | Lecture management and progress tracking |
| `CLI` | `src/cli/index.ts` | Interactive readline interface with options mode |

### New Interaction Pattern (Options-Based)

**Old flow:** User free-form input → hardcoded keyword matching → execute

**New flow (teach-me pattern):**
```
展示选项 → 用户选择（数字或文字） → 意图明确 → 直接执行
```

**Key files for the new pattern:**
- `src/agent/questionGenerator.ts` - Generates options using LLM
- `src/agent/learner.ts` - `executeChoice()` method handles option selections
- `src/cli/index.ts` - `displayOptions()` and `parseChoice()` for options UI

### Data Flow

```
CLI Input → Learner.respond() / Learner.executeChoice()
                    ↓
            QuestionGenerator (if options needed)
                    ↓
                  LLM → generate options
                    ↓
              TeachingResponse { type: 'options', options: [...] }
                    ↓
              CLI displays options, user selects
                    ↓
            Learner.executeChoice(choice.value)
```

### TeachingResponse Types

```typescript
type TeachingResponse = {
  type: 'greeting' | 'teach' | 'question' | 'correct' | 'incorrect' | 'continue' | 'options';
  message: string;
  options?: QuestionOption[];  // For options type
  teachingPoint?: TeachingPoint;
};
```

### QuestionOption Format

```typescript
interface QuestionOption {
  label: string;      // Display text (e.g., "概念1：xxx")
  description: string; // Hint/context (e.g., "继续学习下一个概念")
  value: string;      // Internal value (e.g., "concept:1")
}
```

## Course Content

Lecture files are markdown documents in `/reference/learn-harness-engineering/docs/zh/lectures/` with 12 lectures covering AI agent harness engineering topics.

Lecture structure:
- `narrative` - Story introduction and background
- `teachingPoints` - Core concepts extracted from "## 核心概念" section
- `keyTakeaways` - Key points from "## 关键要点" section

## Reference Documents

Design documents are stored in `docs/superpowers/`:
- `specs/2026-04-11-learnmate-mvp-design.md` - Full design spec
- `plans/2026-04-11-learnmate-mvp-implementation-plan-v2.md` - Implementation plan

Claude Code's teach-me skill reference:
- `.claude/skills/teach-me/SKILL.md` - teach-me skill definition
- `.claude/skills/teach-me/references/pedagogy.md` - Pedagogy theory

Session context is in `SESSION_SUMMARY.md` at repo root.
