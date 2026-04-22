## 这一步你要做什么

1. 运行 `learn-mate agent` —— 同一个裸 prompt，但这次项目里已经有你写的 AGENTS.md / init.sh / feature_list.json。session 记到 `.learn-mate/session-log-v2.txt`
2. 对比 `session-log.txt`（v1）和 `session-log-v2.txt`（v2），写 `diff-notes.md` 描述两次 session 的**具体差异**
3. 运行 `learn-mate check` 验收

## 观察什么

对比 v1 和 v2：

- v2 是否执行了 init.sh？
- v2 是否按 feature_list 顺序一次做一个？
- v2 是否每次改动后跑了 `mvn test`？
- v2 是否更新了 feature_list.json 的 done 字段？
- v2 是否保留了 add（没破坏已有功能）？
- v2 最终是否真的实现了全部 4 个命令？

不需要全列，指出 **2 个以上具体差异** 就行。

## diff-notes.md 骨架

```markdown
# v1 vs v2 差异笔记

## 行为差异
1. v1 跳过测试直接说"完成"；v2 在每个命令后都跑了 mvn test
2. ...

## harness 影响分析
- AGENTS.md 起到了 ... 作用
- feature_list.json 起到了 ... 作用
- init.sh 起到了 ... 作用

## 最大的意外（可选）
v2 还是翻车的地方？哪些 harness 没覆盖？
```

## 为什么你自己写，不是 AI 总结

如果让 AI 总结，你看完就忘了。亲手写一遍，"harness 改变了什么"才会真正进到你脑子里——这是整门课的核心收获。

验收：`learn-mate check` 扫 diff-notes.md，LLM 判是否指出 ≥2 个具体差异。
