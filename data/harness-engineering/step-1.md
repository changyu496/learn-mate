## 为什么需要 AGENTS.md

agent 每次会话都"失忆"——没有地方告诉它"这个项目怎么运作、上次做到哪、验收标准是什么"。AGENTS.md 就是那个地方：给 agent 看的操作手册，约束它怎么在你的项目里工作。

## 回答五个问题

- **指令**：开工前读什么？按什么顺序？
- **状态**：上次做到哪？下一步做什么？记在哪？
- **验证**：怎么判断"做完了"？（不是 agent 自己说完了）
- **范围**：一次只做一个功能，不多做不少做
- **生命周期**：开工 `init.sh` 验证环境，收尾记录进度

## 针对本项目的骨架

```markdown
## Instructions
- 开工先跑 `bash init.sh`
- 读 `feature_list.json` 选一个 done=false 的功能

## State
- `feature_list.json` 是事实来源

## Validation
- 新功能必须有 JUnit 测试；`mvn test` 必须退出码 0

## Scope
- 一次只实现一个子命令；不改 Store.java 已有方法

## Lifecycle
- 开工：bash init.sh
- 收尾：更新 feature_list.json 对应功能的 done 字段
```

不用照抄，五要素答到就行。

## 常见陷阱

- 太抽象（"保持代码整洁"）→ 对 agent 毫无约束
- 没指向具体文件（"参考已有代码"）→ agent 不知道去哪找
- 太长（>200 行）→ agent 抓不住重点

写完运行 `learn-mate check`，我按五要素逐项给反馈。
