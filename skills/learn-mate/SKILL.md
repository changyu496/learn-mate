---
name: learn_mate
description: AI 私教，带你真正学会大模型开发（基于 learn-harness-engineering 课程）
homepage: https://github.com/your-org/learn-mate
metadata:
  {
    "openclaw": {
      "requires": { "bins": ["learn-mate"] },
      "install": [{ "id": "npm", "kind": "npm", "package": "learn-mate" }]
    }
  }
---

# LearnMate

你的个人 AI 私教，帮助你真正学会 LLM 应用开发和 Harness Engineering。

## 当使用

当用户说以下内容时使用此 skill：
- "我要学 harness"
- "我要学 LLM 开发"
- "我想学 AI 应用开发"
- "带我学 xxx"
- "查看我的学习进度"
- "继续学习"

## 使用方式

### 启动学习
```bash
learn-mate start
```

### 继续学习
```bash
learn-mate continue
```

### 查看进度
```bash
learn-mate progress
```

### 设置学习计划
```bash
learn-mate plan set --daily 1 --days 14 --time 20:00
```

### 查看状态
```bash
learn-mate status
```

## 学习流程

1. **入课对话**：Agent 了解用户的水平和目标
2. **制定计划**：协商每日学习量和完成时间
3. **学习 + 考核**：
   - 讲解知识点
   - 出题考核
   - 做对才算掌握
4. **持续陪学**：记住用户状态，隔几天复习

## 核心原则

- **掌握式学习**：做对才算会，不跳过验证
- **警惕流畅性错觉**：用户说"懂了"不能信，必须出题验证
- **协商式计划**：Agent 和用户一起定计划

## 课程内容

基于 learn-harness-engineering 课程，包含：
- 12 个 Lectures（核心知识点）
- 6 个 Projects（实战练习）
- 多语言支持（Python、Java、JavaScript、Go）

## 注意事项

- 确保 `MINIMAX_API_KEY` 环境变量已设置
- CLI 数据存储在 `~/.learn-mate/data/`
- 可以随时用 `learn-mate progress` 查看进度
