# BACKLOG

v0.1.0 真实 qwen-plus 端到端验证跑完后，沉淀下来的**已知问题**与**未来要做的事**。按优先级分组。

---

## P0：修复后才适合拿给陌生人跑的

### 1. `step-4` 不会自动 reset `src/` 到 template

**现象**：学员第 4 步要做"带 harness 再让 agent 跑一遍"的对比。但如果 step-0 的 agent 已经在 `src/` 写过代码，step-4 的 agent 一进来就会看到 step-0 留下的残骸，"v1 vs v2 同起点重跑"这个前提就破了。

**实际影响**：这次我手动 `rm -rf src && cp -r templates/java-todo/src .` 才让对比可信。学员会忘。

**修复方向**：
- `learn-mate start step-4` 之前做一次确认："即将把 `src/` 回滚到 template 状态，step-0 的 agent 产物会丢失，继续？(y/n)"
- 或者在 step-4 的 rules 里加 `src_is_pristine`，不是就提示学员手动 reset

**文件**：`src/commands/start.js` 或新增 `src/rules/` 钩子

---

### 2. `agentMaxTurns = 25` 对 step-4 来说偏紧

**现象**：qwen-plus 在 AGENTS.md + feature_list.json 的约束下**非常认真**——turn 3-14 还在读源码理解契约，turn 15 才开始写 ListCommand，turn 20 第一次跑 `mvn test` 挂了，turn 23 第二次还挂。到 25 回合截断时，只迭代完了 **list 一个命令**（还没跑通）。

**实际影响**：`diff-notes.md` 里我不得不老实写"v2 在 25 回合里只实际 land 了 list"。"harness 驱动 TDD"这个论点立住了，但"4 个命令能做完"这个结果没立住。

**修复方向**：
- 把 step-4 的 `agentMaxTurns` 提到 50（wall-clock 20 分钟内大概率能做完 4 个）
- 或者把 feature_list.json 从 4 个砍到 2 个（list + done），让"做完并 go green"本身成为可观察事件
- 更进一步：agent 在 AGENTS.md 里明确看到"一次做一个 feature，做完就改 done:true 再开下一个"，这样即使截断也有半成品 + 明确进度

**文件**：`data/harness-engineering.json`（step-4.agentMaxTurns）、`/tmp/lm-real-step0/feature_list.json`（或 template）

---

### 3. qwen 跳过 AGENTS.md 的「收尾」段（不改 `done: true`）

**现象**：AGENTS.md 末尾写了"每做完一个 feature，把 feature_list.json 里对应 `done` 字段改成 true"。v2 跑完 25 回合没改一次。

**推测原因**：
- 优先级排序：agent 把"能跑通测试"排得比"更新元数据"高，被 max_turns 截断后前者还没做完
- 位置偏差：说明在文档末尾，agent 注意力集中在前面的"工具使用"和"契约描述"上

**修复方向**（按激进程度）：
1. 把"更新 done 字段"从 AGENTS.md 末尾挪到每个 feature 的验收清单里（写在 feature_list.json 的 description 里）
2. 在 `check` 规则里加一条：`feature_list.done_count >= 1`，强制 agent 至少 flip 一次，否则 step-4 判失败
3. 改 agent 协议——加一个 `update_progress` 虚拟工具，agent 每做完一件事必须显式调用。有点 overkill

**文件**：`AGENTS.md` template、`feature_list.json` template、`data/harness-engineering.json`（step-4.rules）

---

## P1：有空就修

### 4. `init.sh` 从没被 agent 跑过

AGENTS.md 写了"开工前先跑 `bash init.sh`"。qwen 自己判断环境 OK 就跳了。和问题 3 同源（文档里的"建议"不是"强制"）。

**修复方向**：把 init.sh 从 agent 的职责挪到 harness 外部——`learn-mate start step-4` 自动替 agent 跑一次 init.sh，输出贴到 agent 第一轮的 user message 里。这样 agent 不需要记得去跑。

---

### 5. Agent 的目录探索仍然浪费 10+ 回合

v2 用 turn 3-14 爬目录（list_dir 一层层走）。AGENTS.md 里给了关键路径但没硬性要求"用最少调用完成 orient"。

**修复方向**：在 AGENTS.md 加一条"第一回合先跑 `find src -name '*.java'` 一次性拿到全貌，不要逐层 list_dir"。或者在 agent 的 SYSTEM_PROMPT 里加"优先用 run_shell + find 批量看文件结构"。

**注意**：这条改完要重跑真机验证——有可能 qwen 不会照做，或者照做之后行为变差。

---

### 6. `check --debug` 时 LLM 判卷原文没落盘

现在 judge 的 prompt + raw response 都只在内存里，失败了就看不到。

**修复方向**：`check` 时如果检测到 `LEARN_MATE_DEBUG=1`，把每次 judge 的 `{prompt, response, parsed}` 写到 `.learn-mate/judge-trace/<stepId>-<timestamp>.json`。

**文件**：`src/check/llm.js`

---

### 7. `agent` 命令的实时进度只有 `[turn N] ACTION` 一行

看不到 thought、看不到 tool 结果摘要。学员不好判断 agent 是"在思考"还是"要卡死了"。

**修复方向**：给 `agentCommand` 的 onProgress 加分级：默认只打 turn header；`--verbose` 打 thought + 工具摘要。

**文件**：`src/commands/agent.js`、`src/agent/loop.js`

---

## P2：架构级，v0.2 再考虑

### 8. Harness 文件的"模板"现在是硬编码在代码里的字符串

`src/commands/start.js` 生成 AGENTS.md 的方式是把 markdown 硬写在 JS 里。写新课时要改 JS，不够"纯数据"。

**修复方向**：每个 step 的产出文件放到 `data/harness-engineering/files/<stepId>/<fileName>`，`start` 命令只做"复制 + 变量替换"。课程作者只改数据文件，不碰代码。

---

### 9. 没有 `learn-mate reset`

学员跑废了 / 想重来，只能手动删 `.learn-mate/`。

**修复方向**：`learn-mate reset [--step <id>]`，默认回到 step-0 起点；指定 step 就把 progress 回滚到那一步。

---

### 10. Agent 只支持 OpenAI-compatible `chat/completions`

Anthropic Messages API、Gemini 都不兼容这个协议。课程对"provider 可换"的承诺在 LLM-judge 和 agent 两侧都只对 OpenAI-compatible 成立。

**修复方向**：`src/llm.js` 抽一层 provider adapter。先支持 OpenAI-compatible（现在已有）+ Anthropic Messages API。

---

### 11. 没有一个"我通关了"的完赛证书

学员走完 5 步后，`progress.json` 里 `currentStepId: null`，就结束了。缺一个可以截图发群的 summary。

**修复方向**：`learn-mate status --final` 在 5 步都完成时，渲染一个 ASCII 徽章 + 每步耗时 + 总用时 + "下一步推荐"。

---

## 架构级洞察（这次调试过程中发现，但不是"问题"）

### A. Agent 不会自动读 `AGENTS.md`，这是本产品的生死线

**发现经过**：v2 第一次跑，我以为是 qwen 不够聪明——直到我读日志才发现 agent 根本没读 AGENTS.md。因为没有任何机制把它塞进 system prompt。

**修复**：`src/agent/loop.js::loadProjectInstructions` 在启动时把 AGENTS.md / CLAUDE.md 读出来拼到 system prompt 尾部。模仿 Claude Code、Cursor、Codex 的做法。

**教学价值**：这件事本身就是 harness engineering 的活教材——"状态注入"是 harness 的核心动作。未来做 step-5 或高级课程时，可以把这个发现过程写成案例。

### B. "同一个模型 + 同一个 prompt + 不同 harness" 是可演示的

v1 vs v2 在日志层面肉眼可见差异（turn 2 读 feature_list、主动跑 mvn、迭代修测试 vs 盲写两文件被截断）。这个对比是课程的核心价值，已在 README「10 分钟 Demo」章节写出。

---

## 时间标记

- v0.1.0 真机验证时间：2026-04-19 ~ 2026-04-20
- 验证模型：qwen-plus via DashScope OpenAI-compatible endpoint
- 验证范围：step-0 ~ step-4 全部 5 步，rule + llmCheck 混合判卷

后续每次打开这个项目时，优先看 P0 是否仍未修。
