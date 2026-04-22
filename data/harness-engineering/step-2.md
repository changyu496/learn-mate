## init.sh 解决什么

agent 开工第一件事应该是"验证环境能跑"，不是"直接写代码"。否则它写到一半发现 `mvn` 没装 / JDK 版本不对 / 依赖缺失，然后改环境、装东西、进入失控泥潭。

init.sh 一条命令做完三件事：**安装依赖 → 验证环境 → 确认能跑测试**。退出码 0 = 环境就绪。

## 针对本项目

todo-cli 需要验证的事：

- JDK 可用（`java -version`）
- Maven 可用（`mvn -v`）
- 依赖已拉取（`mvn dependency:resolve -q`）
- 现有测试通过（`mvn test -q`）

示例骨架：

```bash
#!/bin/bash
set -e  # 任何一步失败立即退出

echo "[1/4] 检查 JDK..."
java -version

echo "[2/4] 检查 Maven..."
mvn -v > /dev/null

echo "[3/4] 拉取依赖..."
mvn dependency:resolve -q

echo "[4/4] 跑基线测试..."
mvn test -q

echo "✓ 环境就绪"
```

## 常见陷阱

- 少了 `set -e`：一步失败后续照跑，最后还是报 success
- 放 `mvn clean` 进来：每次全量重编，慢
- 不打印步骤：人和 agent 都不知道卡在哪

验收：`learn-mate check` 实际执行 `bash init.sh`，3 分钟内退出码 0 就过。
