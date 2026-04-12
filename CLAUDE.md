# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**LearnMate** is an AI personal tutor CLI that teaches **Harness Engineering** (building reliable execution environments for AI agents). The core insight: it's NOT a course executor, but a conversational AI tutor that understands course content and teaches in the most suitable way for each user.

### Product Vision

- Not filling users with course content, but **Agent understands course then teaches in the way that fits you best**
- Long-term: a virtual person that interacts via text, voice, video; knows you, remembers you, grows with you
- Current MVP: text-based tutor to validate if the learning model works

### Core Principles

1. **Mastery Learning** - Must answer correctly to be considered "learned", no skipping verification
2. **Socratic Teaching** - Guide users to think through questions
3. **Personalization** - Adjust explanation depth based on user level, preferences, habits
4. **Memory** - Remember users, grow with them, understand them better over time

### Education Theory Behind the Design

**Testing Effect** - Self-testing is more effective than repeated reading (retrieval process strengthens memory)
**Generation Effect** - Answers you generate yourself stick better than passive reception
**Bloom's Taxonomy** - Remember → Understand → Apply → Analyze → Evaluate → Create

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
| `LLMClient` | `src/llm/client.ts` | MiniMax API wrapper with 5 retries and exponential backoff |
| `MemoryStore` | `src/memory/store.ts` | SQLite persistence for users, profiles, learning records, conversations |
| `Course` | `src/curriculum/course.ts` | Lecture management and progress tracking |
| `Scheduler` | `src/notifier/scheduler.ts` | Daily reminder scheduling |

### Data Flow

1. CLI (`src/cli/index.ts`) handles interactive input via readline
2. `Learner` orchestrates tutoring with LLM calls through `LLMClient`
3. All user data persisted via `MemoryStore` to SQLite at `~/.learn-mate/data/learn-mate.db`

### Three-Layer Verification (in `Learner.verifyUnderstanding`)

1. **理解 (Understanding)** - After teaching a concept, ask "能用自己话说说吗？" - verify core concept grasp
2. **应用 (Application)** - Ask "设计一个..." scenario question - verify transfer to real scenarios
3. **练习 (Micro-exercise)** - Give "小练习/写一段" task - verify can generate/write code

Dynamic adjustment based on performance:
- Smooth answers → accelerate, teach multiple concepts at once
- Hesitation → slow down, give more examples
- Wrong answer → re-explain from different angle
- Correct answer → praise + go deeper

### Key Patterns

- Messages format: `{ role: 'system' | 'user' | 'assistant', content: string }`
- Learner responds with `TeachingResponse` type: `{ type, message, question?, teachingPoint? }`
- System prompts define tutor personality and rules (Chinese language, friendly tone)
- Profile updates via simple pattern matching in `updateProfileFromConversation`

### Learning Flow

```
1. Onboarding conversation
   → Agent learns user background, goals, preferences via conversation
   → Build user profile, save to memory

2. Knowledge point learning (loop)
   a) Agent digests course content, explains in own words
   b) Adjust explanation depth based on user level (step-by-step, don't overwhelm)
   c) Use questions instead of statements, guide user to think
   d) Verify understanding: ask questions or have user explain back
   e) If wrong: re-explain from different angle until truly mastered
   f) Move to next knowledge point

3. Continuous memory
   - Remember what user learned, got wrong, weak points
   - Next session automatically review weak points
   - Continuously observe user habits, optimize explanation style
```

## Course Content

Lecture files are markdown documents in `/reference/learn-harness-engineering/docs/zh/lectures/` with 12 lectures covering AI agent harness engineering topics (instruction design, tool configuration, state management, verification feedback).

**Important:** This course teaches how to equip AI coding agents with "harnesses" (model weight之外的工程基础设施), NOT CI/CD platforms.

## Current Status & Known Issues

### Recent Fix (2026-04-11)
**Problem:** AI confused "Harness Engineering" with CI/CD platforms
**Cause:** System prompt didn't clearly specify course content, LLM answered from training knowledge
**Fix:** Added explicit clarification in prompts for:
- `startConversation`, `continueOnboarding`, `teach`, `teachNextConcept`, `verifyUnderstanding`, `continueTeaching`

### API Issue
MiniMax API may return 500 errors with `unknown error (1000)`. If LLM calls fail:
- Check API key validity
- Check MiniMax API quotas
- Consider switching models or checking API endpoint

## Reference Documents

Design documents are stored in `docs/superpowers/`:
- `specs/2026-04-11-learnmate-mvp-design.md` - Full design spec with education theory
- `plans/2026-04-11-learnmate-mvp-implementation-plan-v2.md` - Implementation plan

Session context is in `SESSION_SUMMARY.md` at repo root.
