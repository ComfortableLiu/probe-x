# Rust 最终清洗服务

这是独立的 Rust 计算节点，原来的 `apps/final-data-cleaning-service`、`yarn start:final-cleaning`
及默认整套系统启动方式均保留。调度与管理继续由 NestJS API 提供，两个版本使用同一份 gRPC proto、
ClickHouse 表及监控统计口径；无需迁移事件表。

## 启动

安装当前稳定版 Rust（项目声明最低 Rust 1.89），在仓库根目录执行：

```bash
yarn start:final-cleaning-rust
# 等价命令，默认构建并运行 release 优化版本
bash scripts/start-final-cleaning-rust.sh
```

默认按以下优先级读取配置：进程环境变量 → Rust 自己的 env 文件 → 原 Node 清洗服务的 env 文件。
各目录内依次读取 `.env.${NODE_ENV}.local`、`.env.local`、`.env.${NODE_ENV}`、`.env`，
`NODE_ENV` 默认 `development`。模板 `.env.example` 不会被自动读取。首次构建需要下载 crates.io 依赖。

可从本目录 `config/env/.env.example` 创建自己的配置，或显式指定文件：

```bash
bash scripts/start-final-cleaning-rust.sh --env-file /absolute/path/cleaning.env
# 仅校验配置以及 ClickHouse / Redis 连接，不接入总服务、不执行清洗、不写入数据
bash scripts/start-final-cleaning-rust.sh --check
# 本地调试构建
bash scripts/start-final-cleaning-rust.sh --debug --check
```

部署时先更新并重启 `data-dashboard-api-service`，使其支持 Rust 未完成切片和运行时路由，再启动 Rust 节点。
启动后节点会自动接收总服务下发的任务，不需要另行指定清洗日期。默认 `/health` 为
`http://127.0.0.1:10001/health`，节点 ID 为 `rust-node-<hostname>`，与 Node 版的默认身份和端口分开。
通过 `RUST_NODE_ID` / `RUST_NODE_NAME` 指定身份；`NODE_ID` / `NODE_NAME` 不会覆盖 Rust 身份。

节点上线后自动注册地址和健康检查端口，统一在「系统数据 → 计算节点」查看，不需要手工登记。
未设置 `NODE_ADVERTISE_ADDRESS` 时，节点按连接总服务的本地路由自动识别 IP；识别失败时由总服务使用连接来源 IP 兜底。
`RUST_HEALTH_PORT=0` 可由操作系统分配空闲端口，节点在监听成功后上报实际值。
`NODE_ADVERTISE_ADDRESS` / `NODE_ADVERTISE_PORT` 可覆盖页面中声明的对外地址和健康端口，用于容器端口映射等场景，
不会改变 `RUST_HEALTH_HOST` / `RUST_HEALTH_PORT` 的真实监听。
拓扑中会单独显示实际健康监听；默认 `127.0.0.1` 仅供节点本机访问，自动上报不代表该端口可以从其他机器访问。
总服务不会用节点地址/健康端口反向连接，任务仍走节点主动建立的双向 gRPC 流。
旧节点没有上报端口时保留已知端口，否则显示“—”，不会把 TCP 客户端临时端口记录为服务端口。

两版可在不同机器同时接入。若在同机做对照验证，可用 `RUST_CLEANING_THREADS=2 RUST_TASK_CONCURRENCY=2` 控制 Rust 容量；
每个满核服务的线程预算独立计算，不会自动与另一个进程共享 CPU 预算。

## 处理流程

1. 归因 CPU 池默认大小为 `available_parallelism()`，可用 `RUST_CLEANING_THREADS` 覆盖。
   I/O 任务槽默认为 CPU 池的 4 倍（最多 4096），可用 `RUST_TASK_CONCURRENCY` 独立覆盖；
   等待数据库的任务不占用 Rayon CPU 线程。健康检查同时展示 `cpuThreads` 和 `taskCapacity`，
   总服务按后者下发任务。缓冲内存随任务槽数增长，内存较小或数据库负载较高时应降低任务槽数。
2. 每个任务读取完整的 `(date, session)` 切片，但采用流式、按需拉取，默认每批最多 1000 行、8 MiB，
   单行默认最大 1 MiB。归因是事件自身的扩展参数展开，因此无需整会话排序或跨批保留归因上下文。
   会话计数与读取并行发起，保留完整响应及数量一致性检查；预读队列只有一个批次，读取可与当前批次计算、写入重叠。
3. 归因在 Rayon 池并行计算，批次以所有权转移传递，宽表不经过 JS Worker 结构化克隆。
   每批归因行默认上限 100000；超限会保留失败状态，可降低输入批次大小后重试。
4. 仅查重当前批次，分别补写最终事件和归因 KV。归因按 `(event_id, attr_key, attr_value)` 的
   已有数量抵扣，保留不同原始属性转成同一驼峰键时产生的重复行。
5. 两张输出表各有一个有界写入队列，将不同会话的待写记录合并，仍受 1000 行、8 MiB 上限限制，
   默认最长等待 10ms（`RUST_WRITE_BATCH_WAIT_MS`，0 禁用合批）。只有合并后的 INSERT 完整返回，
   贡献该批次的各任务才收到写入确认；失败会通知同批所有任务，保留各自未完成标记供独立查重补写。
6. 整条响应完整结束、输入数量一致且两张表均真实写入后，才保存完成状态。日志和监控不会代替落库确认。

当前使用 HTTP `JSONEachRow` 与动态宽表字段保持兼容，尚未改成 RowBinary；不会宣称零拷贝或固定加速倍数。
默认启用 ClickHouse 响应 gzip 和 INSERT 请求 gzip（`CLICKHOUSE_COMPRESSION=false` 可关闭）；
参数查询沿用 multipart，响应会压缩，multipart 请求体不压缩。较大 INSERT 的压缩在阻塞线程池执行，避免占用异步网络线程。
Rust 保留 UInt64、DateTime64 原始值；扩展参数的空值、非法 JSON、数组、JS `String(value)` 及键转换
通过 Node 引擎生成的 golden fixture 检验。

## 失败、恢复与监控

- 写入前在 Redis `probe-x:rust-clean:incomplete:<date>` 集合中记录 session，成功后移除。
  标记不设置 TTL，调度器每页检查当前候选的标记，即使最终表已经有部分事件也会继续补洗。
- Rust 接手过的任务以及残留未完成切片的重试仅派给 Rust，避免旧 Node 版的事件级归因查重跳过缺失 KV。
  Rust 离线时这些任务等待 Rust 恢复，普通任务仍可派给 Node。
- 使用可续期的单切片 Redis 租约；只有任务全部成功才保存 24 小时完成键。
  Redis 是必要依赖，应启用持久化并避免清除未完成集合；Redis 不可用时不开始数据写入。
  获取租约与完成键查询并行，持有租约后才写未完成标记；完成键成功保存后，并行移除标记与释放租约。
  所有 Lua 仅操作单个 key，兼容 Redis Cluster，沿用之前的状态 key。
- 链接断开后按 1–30 秒退避重连，已接受任务继续执行。重连首帧携带活跃任务与有界终态历史，
  再重放最新进度，减少断流期间任务完成造成的状态丢失。
- 日志缓存最多 2000 条、终态历史最多 1000 条，上行有界，详情日志默认关闭。
  CPU / 内存 / 任务状态、节点速度、运行处理量和成功率使用现有监控链路；Linux 支持网卡速率采样。
- 处理量和成功率先累计在本地固定分钟桶，由唯一后台任务每秒合并写入 Redis，不阻塞清洗。
  Redis 暂时失败时保留最近两个上海自然日的有界计数重试；更早未上报计数会被丢弃。
  正常退出会额外等待最多 5 秒刷新，异常退出可能丢失尚未上报的监控计数，不影响已落库事件和任务恢复。
- SIGINT / SIGTERM 时先上报不可用，默认等待任务 60 秒。超时退出保留未完成标记，租约到期后可重试。
- 共享协议的进度字段是 Int32；当前明确拒绝单个会话超过 2,147,483,647 个事件，不会静默截断。

双表写入不具备事务原子性，租约和查重不能提供跨进程、网络分区下的严格 exactly-once 保证。
本版本提供部分写入修复与可恢复状态；更严格交付语义需要后续统一任务租约、写入去重及完成凭据。

## 构建与验证

```bash
yarn build:final-cleaning-rust
yarn test:final-cleaning-rust
cargo fmt --manifest-path apps/final-data-cleaning-rust/Cargo.toml --check
cargo clippy --locked --manifest-path apps/final-data-cleaning-rust/Cargo.toml --all-targets -- -D warnings
node --test scripts/rust-cleaning-routing.test.cjs scripts/start-final-cleaning-rust.test.cjs
# 固定本地模拟延迟的小会话基准：不会读取真实env或连接业务服务
node scripts/benchmark-final-cleaning-rust.cjs \
  --binary apps/final-data-cleaning-rust/target/release/probe-x-final-cleaning-rust \
  --cpu-threads 14 --capacity 56 --output tmp/rust-cleaning-benchmark.json
```

Cargo 测试使用本地随机端口模拟 Redis、ClickHouse 和总服务，覆盖归因等价、流式背压、部分写入修复、
任务并发、持久幂等、断流重放等，不连接业务数据库。`Cargo.lock` 随服务提交。
基准默认 224 个会话、每会话 7 条事件，模拟 Redis 20ms / HTTP 10ms 固定响应延迟；
以两表真实写入并获得所有任务完成帧为计时终点，检查事件与归因完整、无重复以及完成标记。
比较版本时保持 CPU 线程、任务槽和模拟延迟一致；另行调整任务槽可以评估 I/O 并发收益。
模拟基准用于复现网络等待开销，不代表生产数据库或 Node 与 Rust 的真实吞吐对比。
本次 9 轮对照结果见 [小会话 I/O 优化基准](benchmarks/2026-10-16-small-sessions.md)。
编译时使用 vendored protoc，无需另行安装系统 protoc。release 产物位于
`apps/final-data-cleaning-rust/target/release/probe-x-final-cleaning-rust`，可通过 `--env-file` 脱离源码目录运行。
