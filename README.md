# LearnMate

> 让 AI 带你真正学会，而不是收藏后吃灰。

LearnMate 是一个 CLI 工具，在本地把你带进一门结构化的 AI/LLM 学习课程——
带你动手写代码、给你一个内置的 coding agent 作对照、
用「规则 + LLM 判官」两阶段验收你的每一步产出，
通过了才推进到下一步。

**目前只开了一门课**：*Harness Engineering 实战（Java）*——
教你怎么给 AI coding agent 搭一套稳定工作环境（AGENTS.md / init.sh / feature_list.json 等），
让同一个模型的输出从"不可靠"变成"可靠"。
面向 Java 开发者，约 2-3 小时。

---

## 目录

- [为什么做这个](#为什么做这个)
- [产品形态](#产品形态)
- [10 分钟 Demo：裸 prompt vs 有 harness](#10-分钟-demo裸-prompt-vs-有-harness)
- [快速开始](#快速开始)
- [命令参考](#命令参考)
- [当前这门课：Harness Engineering 实战](#当前这门课harness-engineering-实战)
- [架构](#架构)
- [扩展：写一门新课程](#扩展写一门新课程)
- [已知限制（MVP-1）](#已知限制mvp-1)
- [路线图](#路线图)
- [致谢](#致谢)

---

## 为什么做这个

你大概也有这种状态：文章收藏了几十篇、视频买了几门、教程跟完还是不会。
知识输入一堆，输出零散，最后问自己「我到底学会了什么」时答不上来。

LearnMate 的假设很简单：**学会的唯一证据是动手做到 + 有人/有东西来验收**。
光看是学不会的，光做自己评估也学不会——反馈闭环里必须有一个「你说完成了，我来核验」的环节。

所以 LearnMate 做这几件事：

1. **把课程拆成可验收的步骤**。每一步都有明确的交付物（一个文件、一段代码、一条命令跑通）
2. **规则 + LLM 两段式验收**。先用代码规则做客观判断（文件存在？JSON 合法？`mvn test` 退出码 0？），规则过了再让 LLM 做语义判断（AGENTS.md 是否覆盖了五要素？feature 描述是否足够具体？）
3. **给你一个内置的 coding agent 做对照实验**。同一个 prompt 在有 / 没有 harness 的情况下跑一次，你亲眼看差别
4. **进度持久化 + 承诺制**。每一步的开始、失败、完成都写进本地 `.learn-mate/progress.json`，加上 onboarding 时选的 deadline，有温和的时间压力

---

## 产品形态

- **CLI，不是 SaaS**。所有课程、模板、进度都在本地。你的代码不出本机。
- **LLM provider 可换**。底层用 OpenAI-compatible 的 `chat/completions` 协议，所以阿里云百炼 / DeepSeek / 智谱 GLM / 月之暗面 / OpenAI / 本地 Ollama 都能跑——只要它讲 OpenAI 方言。
- **课程内容走文件系统**。`data/<courseId>.json` 是课程骨架，`data/<courseId>/step-*.md` 是每步的教学正文，`prompts/judge-*.txt` 是 LLM 判官模板。全部可审、可改、可 fork。
- **内置 agent 用 pseudo-tool JSON 协议**。每回合 LLM 只返回一个 JSON `{thought, action, args}`，我们按 action 派发本地工具（list_dir / read_file / write_file / run_shell / finish）。日志人读 + LLM judge 双友好。

---

## 10 分钟 Demo：裸 prompt vs 有 harness

这段是课程的核心论点，也是产品的价值演示。下面是**真实的 qwen-plus 跑出来的**两份 log 对比（不是造的）。

**相同输入**：
> 这是一个 Java 8 + Maven 的 todo-cli 项目，位于当前目录。目前只有 add 子命令实现。请实现 list、done、delete、search 四个子命令，并让 `mvn -q test` 通过。

### v1：没有 AGENTS.md / init.sh / feature_list.json（步骤 0）

```
[turn 1]  LIST_DIR .
[turn 2]  LIST_DIR src
[turn 3]  LIST_DIR src/main
[turn 4]  LIST_DIR src/main/java
[turn 5]  LIST_DIR src/main/java/com
[turn 6]  LIST_DIR src/main/java/com/learnmate
[turn 7]  LIST_DIR src/main/java/com/learnmate/todo
[turn 8]  READ_FILE App.java
...
[turn 18] WRITE_FILE Store.java (+ 4 新方法)
[turn 19] WRITE_FILE ListCommand.java
[turn 20] WRITE_FILE DoneCommand.java
exit_reason: max_turns
```

7 个回合逐层爬目录、没写测试、从没跑 `mvn test`、被 max_turns 截断时只完成了 4 个命令中的 2 个。"完成"是虚的。

### v2：有 AGENTS.md（自动注入 agent 的 system prompt）+ feature_list.json + init.sh（步骤 4）

```
[turn 1]  LIST_DIR .
[turn 2]  READ_FILE feature_list.json    ← AGENTS.md 说了要读这个
...
[turn 15] WRITE_FILE ListCommand.java
[turn 17] WRITE_FILE App.java            ← 注册新命令
[turn 18] WRITE_FILE ListCommandTest.java ← AGENTS.md 要求新命令要有测试
[turn 20] RUN_SHELL  mvn -q test        → exit=1
[turn 21] READ_FILE ListCommandTest.java ← 看失败原因
[turn 22] WRITE_FILE ListCommandTest.java ← 修 import
[turn 23] RUN_SHELL  mvn -q test        → exit=1, 2 个 assertion 失败
[turn 24] READ_FILE ListCommand.java
[turn 25] WRITE_FILE ListCommand.java
exit_reason: max_turns
```

同一个模型、同一个 prompt，行为变成了：**读清单 → 写代码 → 写测试 → 跑测试 → 看失败 → 迭代**。
25 回合烧完只做完 1 个命令，但那 1 个是在真正的闭环验证里反复推敲的。

**关键变量是 AGENTS.md 被自动注入 agent 的 system prompt**——这是 Claude Code / Cursor / Codex 的默认行为。
LearnMate 的内置 agent 启动时会自动检查 `AGENTS.md` / `CLAUDE.md`，读到就拼进 system prompt。
这让你在任何 OpenAI-compatible 模型上，都能复刻「harness 让模型变靠谱」的效果。

这个对比不是我编的故事——**就是你做完这门课的第 4 步会亲眼看到的**。

---

## 快速开始

### 环境要求

| 项 | 版本 | 必需？ |
|---|---|---|
| Node.js | ≥ 18 | 必需（跑 LearnMate 本身） |
| Java | ≥ 8 | 必需（跑 Java 课程） |
| Maven | ≥ 3.6 | 必需（跑 Java 课程） |
| LLM API key | OpenAI-compatible | 必需（Phase 2 LLM 验收 + 内置 agent） |

### 安装

```bash
git clone <this-repo-url> learn-mate
cd learn-mate
npm install
# 全局可用（推荐）
npm link
# 或者每次用完整路径调用
node bin/learn-mate.js ...
```

### 配置 LLM

LearnMate 读三个环境变量：

| 变量 | 作用 | 示例 |
|---|---|---|
| `OPENAI_API_KEY` 或 `DASHSCOPE_API_KEY` | API 密钥（任一个都行） | `sk-xxx` |
| `OPENAI_BASE_URL` | 可选，OpenAI-compatible endpoint | 默认 `https://api.openai.com/v1` |
| `LEARN_MATE_MODEL` | 可选，模型名 | 默认 `qwen-plus` |

**推荐阿里云百炼（qwen-plus）——便宜、中文友好**：

```bash
export DASHSCOPE_API_KEY='sk-xxx'
export OPENAI_BASE_URL='https://dashscope.aliyuncs.com/compatible-mode/v1'
# 模型不用改，默认就是 qwen-plus
```

其他 provider 示例：

```bash
# OpenAI 官方
export OPENAI_API_KEY='sk-xxx'
# OPENAI_BASE_URL 不用设
export LEARN_MATE_MODEL='gpt-4o-mini'

# DeepSeek
export OPENAI_API_KEY='sk-xxx'
export OPENAI_BASE_URL='https://api.deepseek.com/v1'
export LEARN_MATE_MODEL='deepseek-chat'

# 本地 Ollama
export OPENAI_API_KEY='dummy'
export OPENAI_BASE_URL='http://localhost:11434/v1'
export LEARN_MATE_MODEL='qwen2.5-coder:14b'
```

### 走完第一门课

```bash
# 在任意目录初始化一个学习项目（会复制 Java 模板 + 问几个背景问题）
learn-mate init ~/my-learning/harness
cd ~/my-learning/harness

# 查看当前步骤的教学内容
learn-mate start

# 做完步骤的交付物后，验收
learn-mate check
# 通过 → 自动推进到下一步

# 某些步骤（step-0 / step-4）需要跑内置 agent
learn-mate agent

# 任何时候看进度
learn-mate status
```

第一门课 5 步，总时长约 2-3 小时（含两次 agent 跑）。

---

## 命令参考

### `learn-mate init <path>`

在 `<path>` 初始化一个学习项目。做的事：

1. **preflight 检查**：Java、Maven 是否可用（硬性，缺就停），LLM API key 是否已设（软性，check/agent 阶段才需要）
2. **onboarding 问答**：agent 经验、AGENTS.md 熟悉度、学习目的、期望节奏——共 4 个固定选项题，结果写进 profile，`pace` 映射成承诺 deadline
3. **复制模板**：当前课程（`harness-engineering`）对应 `templates/java-todo-cli/`，整份拷贝到 `<path>`
4. **写进度文件**：`<path>/.learn-mate/progress.json`

### `learn-mate start`

在一个已 init 的项目里运行。显示：

- 课程标题 + deadline 倒计时
- 当前步骤 id / 标题 / 目标
- 当前步骤的教学 markdown 正文（从 `data/<courseId>/<teachingFile>` 加载）
- 交付物清单
- "做完后跑 learn-mate check" 提示

会写一个 `step_start` 事件到 progress.events。

### `learn-mate check`

两阶段验收当前步骤：

**Phase 1 — 规则判**（代码验）
- 支持的规则类型：`file_exists` / `min_chars` / `min_lines` / `has_shebang` / `exec_exit_zero` / `valid_json` / `json_shape`
- 全部通过才进入 Phase 2；任何一条失败立刻返回，提示修复

**Phase 2 — LLM 判官**（语义验，可选）
- 加载 `prompts/judge-<checkId>.txt` 模板，填进当前步骤的 `inputPaths` 文件内容
- 用 `response_format: json_object` 调 LLM，解析 `{pass, items, feedback}` 结构
- 全部 pass=true 才通过

通过则：把当前步骤加进 `completedSteps`，`currentStepId` 指向下一步（或 null 表示课程完成），写 `step_complete` 事件。

### `learn-mate agent`

在当前步骤配了 `agentPrompt` 时才可用（目前是 step-0 和 step-4）。做的事：

1. 检查 LLM API key，没有就报错退出
2. 读 `agentPrompt` 作为 user message，读 `AGENTS.md` / `CLAUDE.md`（有就注入 system prompt）
3. 开启 pseudo-tool JSON 循环：每回合 LLM 返回一个 JSON，本地派发工具，结果回传
4. 工具：`list_dir` / `read_file` / `write_file` / `run_shell` / `finish`
5. 预算：`agentMaxTurns`（课程配）单命令 120s / 总 15 分钟软上限
6. 结束写人读友好的 session log 到 `<projectPath>/<agentLogFile>`

### `learn-mate status`

打印简要进度：课程标题 / 开始时间 / 当前步骤 / 已完成 N/总步骤数 / deadline 剩余天数 / 最近一条事件。

---

## 当前这门课：Harness Engineering 实战

### 课程主张

> 模型能力很强，但放到真实仓库里跑就常常翻车。这不是模型的问题，是**工作环境**的问题。
> Harness engineering 就是围绕 agent 搭建一套工作环境——指令、状态、验证、范围、生命周期。
> 同一个模型从"不可靠"到"可靠"是质变，不是微调。

### 5 步结构

| step | 主题 | 交付物 | 验收方式 |
|---|---|---|---|
| 0 | 裸提示词对照 | `.learn-mate/session-log.txt`（内置 agent 跑出来） | rule: 文件 + ≥50 行；LLM: 识别 ≥2 个失败模式 |
| 1 | 编写 AGENTS.md | `AGENTS.md` | rule: 存在 + ≥500 字符；LLM: 覆盖五要素（指令/状态/验证/范围/生命周期） |
| 2 | 编写 init.sh | `init.sh` | rule: 存在 + 有 shebang + `bash init.sh` 退出码 0 |
| 3 | 编写 feature_list.json | `feature_list.json` | rule: 合法 JSON + features 数组 ≥4 条 + 每条含 id/description/done；LLM: 每个 description 足够具体 |
| 4 | 重跑同一个提示词 | `.learn-mate/session-log-v2.txt` + `diff-notes.md` | rule: 两份文件都存在 + diff-notes ≥200 字符；LLM: diff-notes 指出 ≥2 个具体差异 |

### 为什么是这 5 步

- **step 0 必须在前面**：没有基线对照，学员感受不到 harness 为什么有用，后面学写 AGENTS.md / init.sh 都变成"老师叫我写就写"的机械动作
- **step 1 / 2 / 3 的顺序不能换**：AGENTS.md 是总纲（告诉 agent「读 feature_list」「跑 init.sh」），所以 AGENTS.md 必须先写；init.sh 是 AGENTS.md 引用的具体命令；feature_list.json 是 AGENTS.md 引用的具体数据
- **step 4 是验证步**：它既验证你写的 harness 真的有效果（对比 v1），也让你亲手写 diff-notes 把"harness 改变了什么"在自己脑子里过一遍——这才会真正进你脑子，而不是看完就忘

### 每步大约耗时

| step | 用户动作 | 大致时长 |
|---|---|---|
| 0 | `learn-mate agent` + `learn-mate check` | 3-6 分钟（大部分是 LLM 在跑） |
| 1 | 手写 AGENTS.md（~500-1500 字） | 20-40 分钟 |
| 2 | 手写 `init.sh`（~10 行） | 5-15 分钟 |
| 3 | 手写 `feature_list.json`（4 条 feature） | 15-30 分钟 |
| 4 | `learn-mate agent` + 写 diff-notes + check | 15-30 分钟 |

---

## 架构

### 模块

```
learn-mate/
├── bin/learn-mate.js              # shebang + 转发到 src/index.js
├── src/
│   ├── index.js                   # commander CLI 入口，注册 5 个命令
│   ├── commands/
│   │   ├── init.js                # preflight + onboarding + 模板复制 + 写 progress
│   │   ├── start.js               # 读进度 + 渲染教学 markdown
│   │   ├── status.js              # 读进度 + 格式化
│   │   ├── check.js               # 规则判 + LLM 判官 → 推进步骤
│   │   └── agent.js               # 内置 agent CLI 入口
│   ├── agent/
│   │   ├── tools.js               # list_dir / read_file / write_file / run_shell 实现
│   │   └── loop.js                # pseudo-tool JSON 循环 + AGENTS.md 自动注入
│   ├── check/
│   │   ├── rules.js               # 规则判（7 种 rule type）
│   │   └── judge.js               # LLM 判官（加载 prompt + 调 LLM + 解析 JSON）
│   ├── course.js                  # 从 data/ 加载课程定义
│   ├── progress.js                # progress.json 读写 + 事件追加 + deadline 计算
│   ├── onboarding.js              # 固定选项问答
│   ├── preflight.js               # Java / Maven / API key 环境检查
│   └── llm.js                     # 极简 OpenAI-compatible client（单函数 chatComplete）
├── data/
│   ├── harness-engineering.json   # 课程骨架（5 步 + 每步 rubric）
│   └── harness-engineering/
│       ├── step-0.md              # 每步的教学正文
│       ├── step-1.md
│       ├── step-2.md
│       ├── step-3.md
│       └── step-4.md
├── prompts/
│   ├── judge-baseline-failures.txt       # step-0 的 LLM 判官模板
│   ├── judge-five-elements.txt           # step-1
│   ├── judge-description-specificity.txt # step-3
│   └── judge-diff-specificity.txt        # step-4
├── templates/
│   └── java-todo-cli/             # 课程初始的 Java 项目骨架
│       ├── pom.xml                # picocli + jackson-databind + junit-jupiter
│       └── src/…                  # App / Store / Task / AddCommand + AddCommandTest
└── package.json                   # name/version/bin/deps（chalk + commander，仅此 2 项）
```

### 数据流

**init**：
```
learn-mate init ~/my-learn
  ├─ preflight() → [Java✓, Maven✓, LLM key?]
  ├─ runOnboarding(course) → { profile, goals, pathOverrides }
  ├─ fs.cp(templates/java-todo-cli, ~/my-learn)
  └─ initProgress(~/my-learn, course, onboarding)
       → ~/my-learn/.learn-mate/progress.json
```

**check**（Phase 1 + Phase 2）：
```
learn-mate check
  ├─ readProgress() → current step
  ├─ runRules(step.rubric.rules, cwd) → [{label, ok, detail}]
  │    └─ 任何 !ok 立刻 return，写 check_failed 事件
  ├─ runLlmChecks(step.rubric.llmChecks, cwd) → [{id, ok, parsed}]
  │    └─ 每个 check：loadPrompt + buildFilesBlock + chatComplete + parseJson
  └─ 全过 → completedSteps.push(step.id) + currentStepId 指向下一步 + step_complete 事件
```

**agent**：
```
learn-mate agent
  ├─ readProgress() → step.agentPrompt / agentLogFile
  ├─ loadProjectInstructions(cwd) → AGENTS.md 内容（拼进 system prompt）
  ├─ 循环 turn 1..maxTurns:
  │    ├─ chatComplete(messages, response_format: json_object)
  │    ├─ parse LLM JSON → { action, args, thought }
  │    ├─ action === finish → break
  │    ├─ 派发到 tools.TOOLS[action](cwd, args) → result
  │    └─ messages.push(assistant) + messages.push(tool-result)
  └─ 落盘 logFile + 返回 { turns, wallClockMs, finishReason }
```

### 为什么用 pseudo-tool JSON 而不是 native tool-calling

- **provider 可换**：不是所有 OpenAI-compatible endpoint 都稳定支持 `tools` 参数（百炼、DeepSeek、智谱的行为不一），JSON mode 则几乎通用
- **日志友好**：一回合一个 JSON 对象，人读 / LLM judge 都能一眼看清 "想什么 / 做什么 / 结果如何"
- **调试简单**：没有 SDK 抽象，整个协议 70 行代码说清楚
- **代价**：一回合一步，比 parallel tool-calls 慢——但对教学场景（一次就 20-25 回合）完全够用

### rubric：`rule` + `llmCheck` 为什么分两段

- 规则部分是**廉价、确定、可复现**的判断。文件存在 / JSON 合法 / exit code 0 这种东西，没必要烧 LLM token。
- LLM 判官部分是**贵、软、会飘**的判断。"这份文档是否覆盖了五要素"、"这些 description 是否够具体"——只有语义理解才做得到。
- 两段顺序：规则不过立刻返回，省 LLM 调用成本。规则过了才轮到 LLM，此时如果 LLM 又判不过，用户修的是质量问题不是格式问题，反馈更精准。

---

## 扩展：写一门新课程

### 最小闭环

1. 在 `data/` 下加 `<course-id>.json`：
   ```json
   {
     "id": "my-course",
     "title": "我的课程",
     "language": "python",
     "templateId": "python-starter",
     "intro": "一段介绍...",
     "backgroundQuestions": [...],
     "steps": [
       {
         "id": "step-0",
         "title": "...",
         "goal": "...",
         "teachingFile": "my-course/step-0.md",
         "deliverables": ["..."],
         "rubric": {
           "rules": [{ "type": "file_exists", "path": "..." }],
           "llmChecks": []
         }
       }
     ]
   }
   ```
2. 在 `data/<course-id>/` 下加 `step-*.md` 教学正文
3. 如果有 LLM 判官，在 `prompts/` 下加 `judge-<checkId>.txt`（模板里用 `{{FILES}}` 占位符）
4. 如果有项目骨架，在 `templates/<templateId>/` 下放整份代码
5. 改 `src/commands/init.js` 的 `DEFAULT_COURSE_ID`，或者给 init 加 `--course <id>` 参数（TODO）

### 步骤的 rubric 能怎么写

**规则（rule）类型参考 `src/check/rules.js`**：

- `file_exists` — `{ type, path }`
- `min_chars` — `{ type, path, minChars }`
- `min_lines` — `{ type, path, minLines }`
- `has_shebang` — `{ type, path }`
- `exec_exit_zero` — `{ type, cmd, timeoutSec? }`
- `valid_json` — `{ type, path }`
- `json_shape` — `{ type, path, requires: { arrayPath?, minItems?, itemFields? } }`

要加新规则类型：在 `runRule()` 里加一个 `case`，纯函数风格返回 `{ label, ok, detail? }`。

**LLM 判官**：
- 在课程 JSON 的 `llmChecks` 里加 `{ id, description, inputPaths, passCriteria }`
- 在 `prompts/` 下建 `judge-<id>.txt`，里面有 `{{FILES}}` 占位符
- prompt 结尾要求返回 `{ pass, items, feedback }` 格式 JSON
- judge.js 会按 `parsed.pass` 判 ok

### 为内置 agent 某一步配 prompt

课程 JSON 的某个 step 里加：
```json
{
  "agentPrompt": "用户要让 agent 做的事情...",
  "agentLogFile": ".learn-mate/session-log.txt",
  "agentMaxTurns": 25
}
```
只有配了这三项的 step，`learn-mate agent` 才会跑；否则会提示"当前步骤不需要内置 agent"。

---

## 已知限制（MVP-1）

**产品本身**：

1. **只有一门课**。Harness Engineering（Java）。支持更多语言（Python / Go / TS）需要新模板 + 新课程 JSON。
2. **onboarding 是固定选项**，不是自由问答。好处是 deterministic，坏处是遇到一个"我是个 Python 老手但刚学 Java"的用户，工具没有承接。
3. **教学内容是预写的 markdown**，不是 AI 生成。保证了质量可审、表达风格统一，代价是无法根据用户水平动态调整深度。
4. **没有 `learn-mate ask <question>`**。用户卡住时没有对话入口，只能硬啃教学 markdown。

**内置 agent**：

5. **`run_shell` 在项目目录里无沙箱**。只限制了 cwd 和单命令 120s timeout，没有 capability confinement。靠"用户只在专用学习目录跑"的社交契约。不要在你的主工作仓库里跑。
6. **Session log 不是增量落盘**。进程被 `kill -9` 会丢整个 log——但正常运行下 finish / max_turns / wall_clock / llm_error 这 4 种退出路径都会完整落盘。
7. **20-25 回合对 qwen-plus 偏紧**。我们在 step-4 观察到：有 harness 后 agent 会做"写代码 → 写测试 → 跑测试 → 迭代"的 6-8 回合闭环，4 个命令做完理论需要 30-40 回合。课程当前设置更偏"让学员看到迭代行为开始发生"，而不是"让 agent 真正把课程的目标代码写完"。如果你换用更慢但更强的模型（如 Claude Sonnet / GPT-4o），可以在课程 JSON 里把 `agentMaxTurns` 调到 40+。
8. **qwen-plus 仍然会"浪费"~12 个回合在目录探索**。AGENTS.md 减轻了这个问题但没根治。进阶 harness 会在 AGENTS.md 里加"用 `find src -name '*.java'` 一次性 orient"这种硬性指令。

**课程逻辑**（需要 v0.2 之前修）：

9. **step-4 前不会自动 reset `src/`**。如果 step-0 的 v1 agent 留下了半成品代码，step-4 的 v2 agent 会在其上续工，v1/v2 对比就不纯粹。目前的权宜之计是教学 markdown 里引导用户自己判断要不要 reset；未来会在 `learn-mate agent` 加一个 `--reset-src` 标志或者自动备份 + reset。
10. **AGENTS.md 的"收尾"指令 qwen-plus 会跳过**。我们观察到即使 AGENTS.md 末尾写了"更新 feature_list.json.done = true"，agent 也不做。原因是 agent 的 attention 优先级排在 feature_list 描述上，末尾的 meta 指令被忽略。解决方向在课程的 step-1 教学里加一条"把关键收尾动作放在每个 feature 的 verification checklist 里，不要塞在 AGENTS.md 末尾"——但 MVP-1 没做。
11. **某些 LLM judge prompt 对中等质量答案过严**。我们在 step-1 遇到过：学员写了合格的 AGENTS.md，但因为没把"开工 / 收尾"独立成 `Lifecycle` 章节，qwen 按 label-matching 判失败。已经改 prompt 为"按语义抽取，不追求章节名对齐"。类似的 judge 严格度校准可能还有隐藏 case，欢迎 issue。

---

## 路线图

**v0.2 — 把 MVP-1 坐实**
- `learn-mate agent --reset-src`（修限制 #9）
- `learn-mate ask <question>`——课程上下文里的问答入口（修限制 #4）
- 几个 judge prompt 的严格度校准（跑多几组真实样本）

**v0.3 — 扩课程**
- Python 版 Harness Engineering（Flask/FastAPI 的 tool-use 项目）
- Go 版（对比静态类型语言 harness 的不同）

**v0.4 — 探索 LLM 深度带学**
- 把教学 markdown 从"预写"升级为"预写 + 用户背景动态润色"
- 探索用 LLM 帮用户写 AGENTS.md 草稿（然后人来 review / 改）而不是手写
- 个人学习档案跨课程沉淀（多课共用的 profile）

**更远**
- 团队版（组里共用课程 + 互相 review）
- 课程市场

---

## 致谢

- **课程原材料**：`reference/learn-harness-engineering/` 目录下的六个 harness 项目（Obed Marsh 原版英文 + 中文翻译）。本产品把其中的项目 01（Java todo-cli）改造成带验收环节的带学课程。
- **agent 协议灵感**：Claude Code / Cursor 的 CLAUDE.md / AGENTS.md 自动注入机制，以及 Anthropic 官方对 tool-use 的公开实践。
- **所有内部测试对话**：从把产品形态从"订阅课程 app"砍到"CLI 本地工具"的每一次拉扯，到发现"AGENTS.md 不自动注入等于 step-4 白做"的那一刻——这个产品是在持续被挑战中长出来的。

---

## 许可

TODO — 作者决定许可证后补充。仓库目前为未发布状态。

---

_最后，如果你在某一步卡住了，运行 `learn-mate status` 看看自己在哪，读一下对应步骤的 `data/harness-engineering/step-*.md`。LearnMate 不骂人，但 qwen-plus 的 LLM judge 偶尔会很直接。它说你的 AGENTS.md "生命周期未覆盖"时，多半真的是语焉不详，去把它讲清楚就好。_
