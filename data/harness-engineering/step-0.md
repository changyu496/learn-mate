## 这一步你要做什么

不做任何事。learn-mate 会在你的 todo-cli 项目里跑一个**裸的 coding agent**——没有 AGENTS.md、没有 init.sh、没有 feature_list.json，只给它一句自然语言 prompt：

> 请实现 list、done、delete、search 四个子命令，每个都要有测试。

然后你**观察它翻车**。整个 session 会记录到 `.learn-mate/session-log.txt`。

## 为什么要先做这个

你后面 3 步要写的 AGENTS.md / init.sh / feature_list.json 不是凭空的规范，是针对 agent 真实的失败模式对症下药。没有这一步基线，你感受不到 harness 为什么有用。

## 观察什么

常见失败模式（agent 不一定全出现，出现哪个都要记下来）：

- 只实现了部分命令（做了 list 漏了 search）
- 改坏了已有的 add
- 说"完成"但没跑 `mvn test`
- 测试失败仍报告成功
- 一次把四个命令全塞进一个 commit

## 下一步

1. 运行 `learn-mate agent` —— 内置 agent 会在你的项目里跑起来，过程日志写入 `.learn-mate/session-log.txt`（通常 3-6 分钟）
2. 看一眼 log，留意它在哪里翻车、在哪里说谎
3. 运行 `learn-mate check` —— 规则判文件存在 + 最小长度，LLM 判官扫 log 识别 ≥ 2 个失败模式

确认后进入 step-1。
