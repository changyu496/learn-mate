# LearnMate 开发会话总结

## 项目概述
**LearnMate** - AI 私教产品，核心是拟人化的对话式教学，不是课程执行器。

## 项目位置
`/Users/changyu/Project/llm-tutor/learn-mate`

## 技术栈
- TypeScript + Node.js
- SQLite (better-sqlite3) 持久化
- MiniMax API (Anthropic 兼容格式)
- 子账户集成

## 当前状态

### 已完成
1. 核心架构：MemoryStore、Course、Learner、CLI
2. 三层验证体系：理解检查 → 应用检查 → 微练习
3. 对话式教学流程
4. 用户画像和学习记录持久化

### 待解决问题
- **MiniMax API 500 错误**：`unknown error (1000)`
- 最近一次错误的 request_id：`0629840bd8b9318c680fd6911c7d1731`
- 当前所有 LLM 调用都失败

### 最新修复 (2026-04-11)
**问题**：AI 把"Harness 工程"误认为是 CI/CD 平台
**原因**：System prompt 没有明确说明课程内容，LLM 用训练知识回答
**修复**：在以下方法的 prompt 中都加了明确说明：
- `startConversation`
- `continueOnboarding`
- `teach`
- `teachNextConcept`
- `verifyUnderstanding`
- `continueTeaching`

修复后测试输出：
> "关于这个方向，简单来说就是：怎么给 AI coding agent 搭一个靠谱的'工作台'，让它能稳定地帮你写代码、跑任务、交付结果。不是教 AI 怎么写代码，而是教你怎么**配置和驯服** AI 工具"

## 课程内容
路径：`/Users/changyu/Project/llm-tutor/reference/learn-harness-engineering/docs/zh/lectures/`
- 12 个 lecture，讲 AI Agent 的 Harness 工程
- 不是 CI/CD，是"模型权重之外的工程基础设施"

## 启动命令
```bash
cd /Users/changyu/Project/llm-tutor/learn-mate
export MINIMAX_API_KEY="your-key"  # 从 ~/.zshrc 加载
npm run start
```

## 下次继续开发时需要做的
1. 检查 API key 是否有效
2. 如果还是 500 错误，考虑：
   - 检查 MiniMax API 限额
   - 切换到其他模型
   - 查看 API 端点是否正确

## Git 提交记录
- 已有多次提交，最后一次是 curriculum parser 重构

## 关键文件
- `/Users/changyu/Project/llm-tutor/learn-mate/src/agent/learner.ts` - 核心 Agent 逻辑
- `/Users/changyu/Project/llm-tutor/learn-mate/src/cli/index.ts` - CLI 入口
- `/Users/changyu/Project/llm-tutor/learn-mate/src/memory/store.ts` - 持久化层
- `/Users/changyu/Project/llm-tutor/learn-mate/src/llm/client.ts` - LLM 客户端
