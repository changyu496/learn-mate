# learn-mate — Claude / Agent 协作说明

> 这个文件会被 Claude Code 自动加载到 session context 开头。它是给 **agent 干活用的操作手册**，不是对外介绍——对外介绍看 `README.md`。
>
> 原则：短、可执行、只写 agent 真的需要的。长篇讲义放 `README.md`、设计决策放 `docs/real-qwen-validation.md`、待办放 `BACKLOG.md`。

---

## 1. 项目是什么（30 秒）

LearnMate 是一个 **Node.js CLI**，教 Java 开发者做 **Harness Engineering**——用 picocli + Jackson + JUnit5 的 todo-cli 当试验场，5 步课程从"让 agent 裸跑失败"走到"加 harness 后同一个 prompt 行为变好"。

核心主张（已经用 qwen-plus 端到端验证过，证据在 `docs/real-qwen-validation.md`）：**同一个模型 + 同一个 prompt + 不同 harness → agent 行为肉眼可见地改变。**

当前版本：**v0.1.0（MVP-1）**。单课程 (`harness-engineering`)、单 provider 协议 (OpenAI-compatible `/chat/completions`)。

---

## 2. 代码地图（干活前先认路）

```
bin/learn-mate.js               CLI 入口（commander）
src/
  index.js                      命令注册
  course.js                     课程加载（data/*.json → 内存）
  progress.js                   .learn-mate/progress.json 读写
  preflight.js                  node/java/maven 版本检查
  onboarding.js                 首次使用的引导
  llm.js                        OpenAI-compatible fetch 客户端（含 AbortController 超时）
  commands/
    init.js                     学员目录初始化
    start.js                    start <stepId>，生成 harness 产物 / 讲义
    check.js                    rule + llmCheck 混合判卷
    agent.js                    调用内置 agent 跑裸 prompt
    status.js                   progress 可视化
  agent/
    loop.js                     主循环 + loadProjectInstructions (自动注入 AGENTS.md/CLAUDE.md)
    tools.js                    4 个伪工具：list_dir / read_file / write_file / run_shell
  check/
    rules.js                    file_exists / min_chars / min_lines / has_shebang / exec_exit_zero / valid_json / json_shape
    judge.js                    LLM judge 调用 + 结构化解析

data/
  harness-engineering.json      课程元数据（5 步 + 每步的 rules + llmChecks + agent 配置）
  harness-engineering/step-*.md 5 份 step 讲义

prompts/
  judge-*.txt                   LLM judge 的 prompt 模板

templates/
  java-todo-cli/                学员 step-0 起点的 Java 项目模板

docs/
  real-qwen-validation.md       真机验证记录 + 架构修复历史（改 agent 前必读）
```

---

## 3. 当前状态 + 下一步

- `v0.1.0` 已发布到 github（`main` 是最新；`old-mvp-ts` 分支是 2026-04 之前的 TypeScript 尝试版，**不要 merge 过来**）
- 5 步课程 rule + llmCheck 都能过
- 下一步按 `BACKLOG.md`，推荐第一锤：**P0 #1（`step-4` 自动 reset `src/`）**——半天能做完，直接提升产品可信度

---

## 4. 改哪里，先读什么（铁律）

| 要改的区域 | 动手前必读 |
|---|---|
| `src/agent/loop.js` / `src/agent/tools.js` | `docs/real-qwen-validation.md` 的「让这个对比成立的架构修复」+「harness 没解决的事」两段 |
| `prompts/judge-*.txt` | `README.md`「已知限制」章 + `BACKLOG.md` P1 #6（两个 judge prompt 已有修正历史，别改回去） |
| `data/harness-engineering.json` 里的 `rules` / `llmChecks` | 同时看对应 `data/harness-engineering/step-*.md` 讲义——rules 改了讲义不改，学员会懵 |
| `templates/java-todo-cli/` | 改模板会影响所有新学员的 step-0 起点，改完必须端到端重跑一遍 5 步验证 |
| `src/check/rules.js` 新增 rule 类型 | 在 `README.md`「扩展：写一门新课程」章的 rule 目录里同步补一条 |

---

## 5. 常用命令

```bash
# 语法自检（commit 前）
node --check src/agent/loop.js src/agent/tools.js src/commands/agent.js src/index.js

# 冒烟：CLI 自己能跑
node bin/learn-mate.js --help

# 端到端调试（干净起点，不污染 /tmp/lm-real-step0 这份验证产物）
rm -rf /tmp/lm-debug && mkdir /tmp/lm-debug
node bin/learn-mate.js init /tmp/lm-debug
cd /tmp/lm-debug && node /Users/changyu/Project/learn-mate/bin/learn-mate.js status

# 跑 agent（需要 API key）
export DASHSCOPE_API_KEY='sk-...'
export LEARN_MATE_BASE_URL='https://dashscope.aliyuncs.com/compatible-mode/v1'
export LEARN_MATE_MODEL='qwen-plus'
node bin/learn-mate.js agent

# judge 调试
LEARN_MATE_DEBUG=1 node bin/learn-mate.js check
```

---

## 6. 开发纪律（这项目教什么，就自己先做到什么）

- **单任务聚焦**：别同时改多个 step / 多个 command。这是本项目自己在 AGENTS.md 模板里教学员的，我们自己也要做。
- **验证前置**：改 agent 行为后，跑一次真机 agent，把 `.learn-mate/session-log*.txt` 的关键 turn 节选贴进 commit message 或 `docs/`。
- **rules 和 judge 要分工**：能用 rule 判的就不要塞给 LLM judge（rule 免费且确定）。参考 `README.md`「为什么 rule + LLM 分工」那节的决策表。
- **改 prompt 必复测**：prompt 小改动行为差异巨大。改完用 `/tmp/lm-debug` 重跑对应 step 的 check，看 judge 输出的 items + feedback 是否合理。
- **commit 前 `node --check`**：ESM + 无编译，语法错要运行时才暴露——自检一下 10 秒的事。
- **不要 force push `main`**：修 bug 正常 commit 即可；`v0.1.0` tag 已经上 github 的 Releases，不要重打。

---

## 7. 别做的事

- 不要把 `/tmp/lm-real-step0/` 当成 source of truth——那是一次性验证产物，关键证据已经归档到 `docs/real-qwen-validation.md`
- 不要让 agent 的 `run_shell` 工具执行 `rm -rf` 或修改 `src/` 之外的东西——动 learner 环境要有显式用户确认
- 不要把 `reference/` commit 到 git（`.gitignore` 已挡，152M 纯外部学习材料）
- 不要把 `.claude/settings.local.json` commit 到 git（每机器本地的权限 allowlist）
- 不要同步回迁 `old-mvp-ts` 分支的代码——那是不同技术栈的早期尝试，思路可以借鉴但代码不能合

---

## 8. Provider 配置提示

`src/llm.js` 读这些环境变量：

| 变量 | 作用 | 默认 |
|---|---|---|
| `OPENAI_API_KEY` / `DASHSCOPE_API_KEY` | auth（二选一） | 无，必须设 |
| `LEARN_MATE_BASE_URL` | OpenAI-compatible base URL | `https://api.openai.com/v1` |
| `LEARN_MATE_MODEL` | 模型名 | `gpt-4o-mini` |
| `LEARN_MATE_DEBUG` | judge 详细日志 | `0` |

v0.1.0 验证时用的是 **qwen-plus via DashScope**——其它 OpenAI-compatible provider 理论上也能跑，但没真机验证过。

---

## 9. 延伸阅读

遇到"为什么是现在这个设计"类疑问时，按这个顺序读：

1. `README.md` — 产品层（面向用户/学员）
2. `docs/real-qwen-validation.md` — 为什么立住的证据 + 架构 bug 修复史
3. `BACKLOG.md` — 还没解决的 P0/P1/P2
4. `data/harness-engineering/step-*.md` — 课程实际教什么
5. `git log` — 最近变更动机

不要只读代码就动手——这项目有相当一部分"为什么这样"藏在上面几份文档里。
