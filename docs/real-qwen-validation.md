# 真实 qwen-plus 端到端验证记录

> 归档本 MVP-1（v0.1.0）第一次用真模型跑通 5 步课程的过程证据。这份文档回答一个问题：
> **"learn-mate 声称 harness 会改变 agent 行为，这个说法真的立得住吗？"**
>
> 结论：立得住，但代价比想象的大。

---

## 验证环境

| 项 | 值 |
|----|----|
| 日期 | 2026-04-19 ~ 2026-04-20 |
| 模型 | `qwen-plus` via DashScope OpenAI-compatible 接入点 |
| Endpoint | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| 接入方式 | learn-mate 内置 `src/llm.js`（fetch + AbortController），走 `/chat/completions` |
| 课程 | `harness-engineering`（MVP-1 唯一课程，5 步 step-0 ~ step-4） |
| 项目目录 | `/tmp/lm-real-step0/`（Java 8 + Maven todo-cli 模板） |
| Agent 最大回合 | step-0: 20，step-4: 25 |
| 其它参数 | `temperature=0.2`，`response_format: json_object`，90s 单轮超时 |

执行该验证的 wrapper：直接绕过 `learn-mate init` 的交互式 onboarding，手写 `progress.json` 到对应步骤，让 `learn-mate start/check/agent` 走正式路径。

---

## 第 0 步 vs 第 4 步——同一个裸 prompt 的行为差

两次 agent 跑接收的 user prompt **完全一致**：

> 这是一个 Java 8 + Maven 的 todo-cli 项目，位于当前目录。目前只有 add 子命令实现。请实现 list、done、delete、search 四个子命令，并让 `mvn -q test` 通过。

区别只在 project 目录状态：

| | v1（step-0） | v2（step-4） |
|---|---|---|
| `AGENTS.md` | 不存在 | 存在（1159 字符） |
| `init.sh` | 不存在 | 存在 |
| `feature_list.json` | 不存在 | 存在（4 个 feature 的具体描述） |
| `src/` | 模板状态 | **重置为模板状态**（跑前手动 reset） |
| Agent system prompt | 裸 SYSTEM_PROMPT | SYSTEM_PROMPT + AGENTS.md 自动注入 |

两次跑的完整日志分别在 `session-log.txt`（v1）和 `session-log-v2.txt`（v2）。以下节选关键 turn。

---

## v1（step-0，无 harness）的真实走向

**头部**：

```
=== learn-mate agent session ===
started: 2026-04-19T09:09:54.615Z
cwd:     /private/tmp/lm-real-step0
model:   qwen-plus (override: LEARN_MATE_MODEL)
maxTurns:20
```

（注意这次 v1 跑的时候 `loadProjectInstructions` 还没实现——所以 header 里没有 `harness:` 行。这是原样。）

**关键动作序列**：

```
[turn 1]  LIST_DIR .        -> .gitignore, .learn-mate/, pom.xml, src/
[turn 2]  LIST_DIR src
[turn 3]  LIST_DIR src/main
[turn 4]  LIST_DIR src/main/java
[turn 5]  LIST_DIR src/main/java/com
[turn 6]  LIST_DIR src/main/java/com/learnmate
[turn 7]  LIST_DIR src/main/java/com/learnmate/todo     ← 7 回合在爬目录
[turn 8]  READ_FILE App.java
...
[turn 17] thought: "需要扩展 Store 加 4 个方法 + 新增 4 个命令类
                   + 改 App + 写测试"     ← 一口气推到底
[turn 18] WRITE_FILE Store.java (2246 chars)
[turn 19] WRITE_FILE ListCommand.java (803 chars)
[turn 20] WRITE_FILE DoneCommand.java (597 chars)

--- session end ---
turns:        20
wall_clock:   68s
exit_reason:  max_turns
```

**观察到的失败模式**：

1. **无任务清单 → 从零推断契约**：turn 1-7 把所有能 list 的目录都 list 了，turn 8 才开始读源码；具体要做什么到 turn 17 才根据源码注释凑出来
2. **完全没跑过 `mvn test`**：20 回合 0 次 `run_shell`。"完成"是虚的——写完 3 个文件就被截断
3. **范围理解成"全做完"**：turn 17 的 thought 自己说要做 4 个命令 + Store 扩展 + App 改 + 写测试——一口气推到底，被 max_turns 砍断

**产物结算**：
- 写了 `Store.java`、`ListCommand.java`、`DoneCommand.java`——**0 个测试**、**0 次验证**
- 仍缺 `DeleteCommand`、`SearchCommand`、App 的注册、所有新命令的测试

---

## v2（step-4，带 harness）的真实走向

**头部**：

```
=== learn-mate agent session ===
started: 2026-04-20T14:59:01.404Z
cwd:     /private/tmp/lm-real-step0
model:   qwen-plus (override: LEARN_MATE_MODEL)
maxTurns:25
harness: AGENTS.md auto-loaded (1159 chars)    ← 关键行
```

这行 `harness: AGENTS.md auto-loaded` 是这次验证的核心——它证明 `loadProjectInstructions` 在跑前把 AGENTS.md 拼进了 system prompt。这是 v1 和 v2 唯一的运行时差别（除了 `src/` 重置到模板状态）。

**关键动作序列**：

```
[turn 1]  LIST_DIR .              -> 7 entries: AGENTS.md, feature_list.json, init.sh, ...
[turn 2]  READ_FILE feature_list.json     ← AGENTS.md 告诉它开工先读
          thought: "...这是开工前的必要步骤"
[turn 3-13] LIST + READ src/ 结构                 ← 11 回合 orient（还是多，但这次是主动读源码）
[turn 14] thought: "我将从第一个功能 'list' 开始实现"     ← 单任务聚焦
[turn 15] WRITE_FILE ListCommand.java  (923 chars)
[turn 16] READ_FILE App.java
[turn 17] WRITE_FILE App.java (726 chars)                 ← 注册 ListCommand
[turn 18] WRITE_FILE ListCommandTest.java (2183 chars)    ← 主动写测试
[turn 19] WRITE_FILE ListCommandTest.java (2109 chars)    ← 修测试
[turn 20] RUN_SHELL mvn -q test        ← 第 1 次验证，exit=1（编译错，缺 import）
[turn 21] READ_FILE ListCommandTest.java
          thought: "测试编译失败，因为 ListCommandTest 中引用了 ListCommand 类，
                   但该类在 commands 包下，而测试类在默认包，缺少 import"
[turn 22] WRITE_FILE ListCommandTest.java (2157 chars)    ← 加 import
[turn 23] RUN_SHELL mvn -q test        ← 第 2 次验证，exit=1（2 assertion 失败）
[turn 24] READ_FILE ListCommand.java
          thought: "可能是 ListCommand 使用了 printf，而测试中期望的字符串包含空格和换行...
                   另外 ListCommand 当前实现是 Runnable，但 AddCommand 是 Callable<Integer>"
[turn 25] WRITE_FILE ListCommand.java (924 chars)         ← 调整返回类型 / 输出

--- session end ---
turns:        25
wall_clock:   121s
exit_reason:  max_turns
```

**观察到的行为改变**：

1. **turn 2 直接读 feature_list.json**：因为 AGENTS.md 里写了"开工先读 feature_list"——目录爬楼的回合从 v1 的 7 回合压缩到 1 回合
2. **主动写测试 + 主动跑测试**：turn 18 写测试，turn 20 第一次跑，exit=1 → 读日志 → turn 22 修 import → turn 23 再跑 → turn 24 读源码 → turn 25 改实现。**TDD 循环真实发生了**
3. **单任务聚焦**：turn 14 的 thought 明说"我将从第一个功能 'list' 开始实现"。AGENTS.md 的"一次只做一件事"被遵守

**产物结算**：
- 只做完 `ListCommand` + `ListCommandTest`，而且 test 还没完全绿
- 但做的这部分**是真的在做**——有实现、有测试、有两次 `mvn test` 验证、有两次迭代

---

## v1 vs v2 关键指标对比

| 指标 | v1（裸） | v2（带 harness） |
|---|---|---|
| 读 feature_list.json | 从不 | turn 2 |
| 探索回合数（`list_dir` 爬楼） | 7 | 1 |
| 写测试文件数 | 0 | 1（反复迭代） |
| `mvn test` 执行次数 | **0** | **2** |
| "范围"理解 | 4 命令 + Store 扩展 + App 改 + 测试（一锅端） | 先做 list，做通再说 |
| 有效完成功能数 | 声称 3 个，但 0 验证 | 声称 1 个，有测试+验证但未绿 |
| 结束原因 | `max_turns`（20 回合） | `max_turns`（25 回合） |
| Wall clock | 68s | 121s |

**定性总结**（摘自 `/tmp/lm-real-step0/diff-notes.md`）：

> 同一个 qwen-plus、同一个 prompt，harness 让行为从**"盲写 + 假完成"**转向**"读清单 + 测试驱动 + 单任务聚焦"**。代价是速度——原本 20 回合内 agent 凭运气能写 2 个命令（不验证），现在 25 回合只能扎实做完 1 个命令的迭代。**质变方向是"把验证成本前置"**。

---

## 让这个对比成立的架构修复

第一次跑 step-4 时，v2 的行为和 v1 几乎一样——没读 AGENTS.md、没读 feature_list.json、照旧盲写文件。检查后发现根因：

**learn-mate 的内置 agent 在第一版实现里不会自动把 `AGENTS.md` 注入 system prompt。**

Claude Code / Cursor / Codex 都会做这件事（auto-load `AGENTS.md` 或 `CLAUDE.md`）。但我写的 `src/agent/loop.js` 第一版没做——没任何机制让 agent 意识到"有一个叫 AGENTS.md 的东西值得读"。Agent 只会根据模型自己的好奇心决定要不要 `list_dir` 来发现它，而 qwen-plus 在"有明确 user prompt 在催"的情况下根本没动力主动 `list_dir .`。

**修复补丁**（摘自 `src/agent/loop.js` 现状）：

```js
async function loadProjectInstructions(projectPath) {
  const candidates = ['AGENTS.md', 'CLAUDE.md'];
  for (const name of candidates) {
    try {
      const content = await fs.readFile(path.join(projectPath, name), 'utf8');
      return { name, content };
    } catch {}
  }
  return null;
}

// 在 runAgent 里：
const projectInstructions = await loadProjectInstructions(projectPath);
let systemContent = SYSTEM_PROMPT;
if (projectInstructions) {
  systemContent += `\n\n---\n\n## Project-specific instructions ` +
                   `(auto-loaded from ${projectInstructions.name})\n\n` +
                   projectInstructions.content;
}
```

修复后重跑 step-4，才得到上面 v2 的表现。

**这个 bug 本身就是 harness engineering 的活教材**：课程告诉学员"把指令放进 AGENTS.md 就行"，但前提是 agent 确实会去读它。"状态注入"是 harness 的核心机制——这次卡点就发生在"状态注入"机制还没建起来的时候。

---

## harness 没解决的事（诚实记录）

即使在 v2，下面几条依然没搞定（也写进了 `BACKLOG.md`）：

1. **v2 从未执行 `bash init.sh`**——AGENTS.md 写了"开工先跑 init.sh"，agent 直接跳了
2. **v2 从未把 feature_list.json 的 `done: false` 改成 `true`**——AGENTS.md 末尾的"收尾"段没被当回事
3. **v2 在目录探索上仍花了 11 回合**（turn 3-13）——比 v1 好但还有压缩空间

这三条的共同特点：**AGENTS.md 里的"建议性"指令在优先级不高的时候被 agent 跳过。** 想修就要把这些从"建议"变成"强制"——比如由 harness 外部代跑 init.sh、在 rule 里加 `feature_list.done_count >= 1`、在 AGENTS.md 第一条就列"用一次 `find` 拿到全貌"。

---

## 课程完成证据

5 步全部跑完后，`/tmp/lm-real-step0/.learn-mate/progress.json`：

```
completedSteps: ["step-0", "step-1", "step-2", "step-3", "step-4"]
currentStepId:  null
```

每步判卷混合了：
- **rule**：`file_exists` / `min_chars` / `min_lines` / `has_shebang` / `exec_exit_zero` / `valid_json` / `json_shape`
- **llmCheck**：`judge-baseline-failures.txt`、`judge-five-elements.txt`、`judge-diff-specificity.txt` 等

其中两个 judge prompt 在验证过程中被修正（已定稿）：

- `prompts/judge-baseline-failures.txt`：原版有内部矛盾（"找到 ≥2 条失败模式"既说 pass 又说不 pass）。修正为"教学目的就是观察失败，≥2 条即 pass"
- `prompts/judge-five-elements.txt`：原版按字面 label 判（要求 AGENTS.md 里必须有"生命周期""范围"字样）。修正为"按语义抽取，不要求字面标签"

---

## 证据文件

这次验证的原始产物都还在 `/tmp/lm-real-step0/`，没清理：

```
/tmp/lm-real-step0/
├─ AGENTS.md                      # step-3 生成
├─ init.sh                        # step-2 生成
├─ feature_list.json              # step-3 生成
├─ diff-notes.md                  # step-4 学员产物
├─ .learn-mate/
│   ├─ progress.json              # 5 步 completed
│   ├─ session-log.txt            # v1 agent 跑的完整日志
│   └─ session-log-v2.txt         # v2 agent 跑的完整日志
└─ src/                           # 含 v2 留下的 ListCommand + ListCommandTest
```

如果这个 `/tmp` 目录被清了，`README.md` 的「10 分钟 Demo」章节还保留了关键 turn 摘录。

---

## 这个验证给 v0.1.0 的定性

**立住的**：
- "同一个模型 + 同一个 prompt + 不同 harness → 行为肉眼可见地变好" 这个主张有证据
- "rule + LLM judge 混合判卷" 在 5 个 step 上都能跑出可复现结果
- Qwen-plus 作为默认 provider 能承担全部 judge + agent 工作，不需要 GPT-4 级模型

**没立住、但不丢人**：
- "harness 让 agent 一次就做完任务" → **没做完**。v2 在 25 回合里只做完 list 一个命令，代价是质量换速度
- "AGENTS.md 写清楚 agent 就会照做" → **会打折**。init.sh / done 字段更新被 agent 跳过

第二条反而是个**教学机会**——未来可以做一门「Harness 是建议还是强制？」的高级课程，专门讨论如何把"agent 会跳过的建议"转成"必经的机制"。
