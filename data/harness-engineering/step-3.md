## feature_list.json 是什么

一份**机器可读**的功能清单，告诉 agent：

- 项目有哪些功能
- 每个是否完成
- 未完成的具体要做什么

agent 开工时读这个文件，挑一个 done=false 的做；完成后把 done 改成 true。

## 为什么不放在 AGENTS.md 里

AGENTS.md 是自然语言，agent 可能**误读、加戏、重新解释**。JSON 结构 agent 只能遵守，没有发挥空间——这就是"harness 原语"的意思。

## 针对本项目的格式

```json
{
  "features": [
    { "id": "add",    "description": "新增任务，输入 title 生成 id 并持久化",           "done": true  },
    { "id": "list",   "description": "列出所有任务，每行显示 id / title / done 状态",    "done": false },
    { "id": "done",   "description": "按 id 把任务标记为已完成",                         "done": false },
    { "id": "delete", "description": "按 id 删除任务",                                   "done": false },
    { "id": "search", "description": "按 title 子串过滤任务（大小写不敏感）",            "done": false }
  ]
}
```

## 常见陷阱

- 描述太模糊（"improve list"）→ agent 随意发挥
- 不写验收条件 → 可在 description 里加"需通过 ListCommandTest"
- 漏掉 add（已完成）→ agent 可能把它重写一遍

验收：结构规则（features 数组、每项 id/description/done、≥4 项）+ LLM 判描述是否具体。
