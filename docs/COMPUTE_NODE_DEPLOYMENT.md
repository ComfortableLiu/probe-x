# 计算节点部署指南

计算节点（`final-data-cleaning-service`）负责实际的归因清洗计算。它以 **gRPC 客户端主动拨出** 的方式接入总服务（`data-dashboard-api-service`），因此：

- **不需要任何入网端口**：NAT / 防火墙后面也能跑，不用配置端口映射或地址登记。
- **改几行配置就能起**：只需要知道总服务的 `MASTER_HOST:MASTER_PORT`。
- **自动注册**：连上即上报 `nodeId` / 名称 / 地址 / 规格，总服务自动落库，页面立刻可见。
- **链接状态实时可见**：「系统数据 > 计算节点」拓扑图展示真实的连接 / 心跳 / 忙碌 / 异常状态。

```
┌──────────────────┐   NodeControlService/Connect (双向流)   ┌────────────────────────┐
│  计算节点 x N     │ ──────────────────────────────────────▶ │  总服务                  │
│  （gRPC 客户端）   │ ◀────────────────────────────────────── │  data-dashboard-api      │
└──────────────────┘          下发 ComputeTask               └────────────────────────┘
     │  上行：NodeRegister（注册/心跳/NodeInfo）· ProgressUpdate · NodeLogBatch（节点日志）              │
     │  断线 / 心跳超时 → 拓扑图立即显示「离线」                             ▼
     └─ GET /health（仅容器网络内）              GET /api/system-data/computing-nodes
                                                              系统数据 > 计算节点
```

---

## 一、三种部署方式

### 方式 1：`docker run` 一行（跨机器 / NAT 后面，最简）

先构建镜像（或从制品库拉取）：

```bash
docker build -t probe-x/final-data-cleaning-service --build-arg SERVICE_NAME=final-data-cleaning-service .
```

然后在任意一台能访问总服务的机器上：

```bash
docker run -d --name compute-node-1 \
  -e MASTER_HOST=10.0.0.5 \
  -e MASTER_PORT=8105 \
  -e NODE_NAME=计算节点1 \
  -e NODE_ADVERTISE_ADDRESS=10.0.0.8 \
  -e DB_HOST=mysql.internal -e DB_PASSWORD=change-me -e DB_DATABASE=probe_x \
  -e CLICKHOUSE_HOST=http://clickhouse.internal:8123 \
  -e REDIS_HOST=redis.internal -e REDIS_PASSWORD=change-me \
  probe-x/final-data-cleaning-service
```

> 注意这里**没有 `-p` 端口映射**——节点只拨出，不需要入网。
> 唯一对外暴露的 `/health` 也只在容器网络内，供 `docker` 健康检查使用。

多起几个节点：换一个 `--name` 和 `NODE_NAME` 即可（**不要**给它们同一个 `NODE_ID`，留空会按各自容器的主机名生成，天然不同）。

### 方式 2：`docker compose` 同栈扩容

compose 里已经配好接入参数，节点服务**不发布端口**、**不设 `container_name`**，可以直接横向扩容：

```bash
docker compose up -d --build
docker compose up -d --scale final-data-cleaning-service=3
```

3 个副本会按各自的主机名生成 `NODE_ID`，在拓扑图上是 3 个独立的子节点。
它们会共用 `COMPUTE_NODE_NAME`（默认「计算节点」），想区分的话在 `.env` 里设 `COMPUTE_NODE_NAME`，或改用方式 1 / 方式 3 按副本指定 `NODE_NAME`。

### 方式 3：本地开发

```bash
MASTER_HOST=localhost MASTER_PORT=8105 \
NODE_NAME=本地计算节点 \
yarn start:final-cleaning
```

前提是总服务已在本地跑起来（`yarn start:dashboard-api`），并且 MySQL / ClickHouse / Redis 可达。

### 地址和健康检查端口自动上报

Node 与 Rust 节点均在启动后自动注册地址和实际健康检查端口，统一在「系统数据 → 计算节点」查看。
节点详情将节点地址、声明的健康检查端口和实际监听地址分别展示，未上报端口显示“—”。
如需修改节点名称，调整对应服务的 `NODE_NAME` 或 `RUST_NODE_NAME`；如需覆盖声明的地址或端口，
修改 `NODE_ADVERTISE_ADDRESS` / `NODE_ADVERTISE_PORT` 后重启节点。系统不提供手工登记、编辑或删除节点的入口。

Node 自动选择本机可用网卡 IP，Rust 优先使用通往总服务的本地路由 IP；本机总服务可使用环回地址，显式声明地址始终优先。
未识别到地址时，总服务以 gRPC 连接来源 IP 兜底，该来源可能经过 NAT/代理，不保证是可远程访问的健康地址。
总服务只提取连接来源的 IP，不会把临时出站端口作为节点服务端口。

Node 健康监听默认 `0.0.0.0:10000`，用 `HOST` / `PORT` 修改；Rust 默认 `127.0.0.1:10001`，
用 `RUST_HEALTH_HOST` / `RUST_HEALTH_PORT` 修改。监听端口为 `0` 时，成功监听后上报操作系统实际分配值。
实际监听地址/端口会独立展示，环回地址标为“仅本机访问”；声明对外地址或端口不会改变监听配置。
节点主动连接总服务接任务，无需开放入站 gRPC 端口；健康端口仅用于运维检查。

升级时先重启总服务加载新增的兼容协议字段，再重启 Node / Rust 节点刷新注册信息；无需数据库结构迁移。

### 单节点的 CPU 并行计算

每个节点有一个常驻 Worker Threads 池，并发上限由
[`os.availableParallelism()`](https://nodejs.org/download/release/v22.20.0/docs/api/os.html#osavailableparallelism)
自动读取进程可用的 CPU 并行度，无需增加环境变量。节点通过注册/心跳的 `task_capacity`
上报此容量，调度器按剩余槽位同时下发多个独立的 `(date, session)` 任务。
例如节点可用 8 个线程、有 100 个待清洗 session 时，先下发 8 个任务；任意一个完成后立即补发一个。
每个任务的完整事件列表由一个 worker 计算，即使 session 只有几条事件，也能与其他 session 并行。
线程按需创建并复用，节点关闭时统一终止；一个大 session 同样占用一个 worker。

主线程负责查询、汇总进度、查重和写入 ClickHouse；worker 只接收归因需要的六个字段，
并独立展开扩展参数。每个任务的结果保持原始事件顺序，清洗事件保留原数组和全部字段。
worker 每 500 条事件汇报一次进度，主线程按任务最多每 100ms 向总服务发送一次中间进度；
每个任务的进度和开始时间相互独立；节点实时速度使用近 6 秒所有任务的合计处理进度，
跨连续 session 累计，避免短任务来不及产生一秒样本就结束而始终显示横线。
完成帧只补齐尚未统计的处理量，不重复计算已有进度；失败帧不补齐剩余量，幂等空重放不增加速度。
任务刚开始或最近没有事件处理时显示 0，空闲、离线时显示横线。
今日平均速度为所有任务的总新增处理量除以节点忙碌墙钟时长，并发重叠时间只计一次，空闲时间不计。
今日最快/最慢速度为节点约每秒合计采样的极值，忙碌开始和结束的不足一秒区间按实际时长计算；
时钟精度为 1ms，同毫秒到达的非空尾段按 1ms 计入，避免漏掉最终处理量。
忙碌但没有处理进度的有效区间速度为 0。处理量包含失败前已观察到的工作，失败不补未处理目标量。
采样不依赖页面轮询，按上海自然日拆分，断连时结束观察，重连首帧只建立基线。
历史统计使用 Redis `probe-x:overview:v2:nodeCleaning:*`，通过 Lua 原子更新累计量与极值。
旧版单任务统计无法还原节点的重叠时长，保留原 key 但不再展示；升级后从新口径的首个有效采样重新累计。
只有落库成功才标记任务完成，并释放对应槽位。

节点限制整个查询、计算、落库流程的并发数，超发任务在读取数据前等待。
同一 `(date, session)` 的不同任务在节点内依次执行，相同 `task_id` 重放时共享正在执行的任务结果。
一个任务失败只释放自己的槽位，双表写入等待全部结束后再触发重试，其他任务继续执行。
节点离线时，总服务分别落定全部在途任务；重新连接时，节点上报 `active_task_ids`，恢复容量占用。
`/health` 提供 `taskCapacity`、`activeTaskCount` 和 `currentTaskIds`；拓扑页面显示并发占用及全部任务 ID。
首次启动有线程通信和启动成本，实际吞吐还取决于 ClickHouse 查询、写入和可用内存。

构建时会同时生成 `dist/apps/final-data-cleaning-service/main.js` 和 `attribution-worker.js`，
发布时需保留同一目录内的完整产物。现有 Dockerfile 会复制整个 `dist` 目录，无需额外部署步骤。
本次协议增加 `NodeInfo.task_capacity`（字段 12）和 `active_task_ids`（字段 13），需要同时更新总服务、
计算节点和共享 proto。新版总服务对未上报容量的旧节点保守按 1 个任务调度；旧总服务仍每节点下发 1 个任务。

本地开发使用的服务运行插件会在成功编译后先等待旧进程退出，再启动新产物，编译失败时保留当前服务。
两个服务均禁止输出失败构建，保留上次成功的主程序、worker 和协议产物，供当前服务继续使用。
已使用旧配置启动的开发 watcher 需要重启一次才能加载新的自动重启插件。
仅更新 `dist` 文件不会让仍在内存中运行的旧进程加载新代码或重新读取 gRPC 协议。

并发验收命令（使用内存数据库替身、真实 Worker Threads 和 protobuf 编解码）：

```bash
node --test scripts/cleaning-scheduler.test.cjs scripts/cleaning-large-backlog.test.cjs scripts/cleaning-backlog-reader.test.cjs scripts/cleaning-concurrency.test.cjs scripts/clickhouse-stream.test.cjs scripts/restart-service-plugin.test.cjs
yarn workspace final-data-cleaning-service test --runInBand
yarn workspace final-data-cleaning-service build
yarn workspace data-dashboard-api-service build
```

### 大批次清洗调度

点击“立即清洗”会枚举过去日期尚未完成的 `(date, session)` 切片，事件数和任务数不同。
例如百万条事件可能对应十几万个会话任务。旧版把整批任务通过 `push(...tasks)` 展开成函数参数，
任务过多会触发 `RangeError: Maximum call stack size exceeded`，此时错误发生在总服务入队阶段，
增加计算节点线程数或调高栈大小不能解决这段代码的问题。

调度器不再执行全历史 `DISTINCT + NOT IN` 后装满内存队列。启动请求立即登记日期范围并返回，
后台按原表物理排序键 `($service_time, $session_id, $event_name)` 顺序读取，每页默认只取 1000 行键和日期，
不拉取事件宽表内容；只对本页涉及的 `(date, session)` 查询最终表是否已有记录。首批可用任务立即下发，
剩余部分使用严格大于上一页末尾排序键的游标续读，不使用随已清洗集合变化而跳行的 `OFFSET`。
页边界若存在相同排序键的多条事件，它们必属同一切片，任务已在当前页发现，计算节点仍读取该切片完整事件。

无空闲节点或已达到缓冲上限时暂停查询，节点上线/任务落定后继续加载。默认排队和在途任务合计最多 2000 个，
另有至多一页查询结果暂存；最近完成切片缓存最多 10000 条，重试状态在任务最终落定后释放。
加载查询全局串行，查询线程最多 2 个、内存上限 256 MiB、执行时间上限 30 秒。源表查询利用物理排序与 LIMIT 早停，
最终表查重的去重集合受本页候选数量限制；仍可能扫描所涉及日期的最终表，需要按实际磁盘及数据规模评估吞吐。
查询失败保留原游标与已有任务，下一分钟巡检或重复点击触发重试；关机取消在途查询并忽略迟到结果。
重复触发复用正在扫描的范围，跨日的新一轮补扫等待旧轮已加载任务结束后从头扫描，以覆盖旧游标之前失败的切片。
每日完成标记仅在扫描及已加载任务全部落定后写入，服务重启后未结束的自动清洗可从头重新发现欠账。

接口返回的 `pending` 仅表示当前已缓冲任务数，`loading` 表示还有范围待加载，`waitingForCapacity` 表示等待节点空闲；
`pending=0` 不代表全部历史任务已经完成。队列仍按 `(date, session)` 去重，下发遵守节点线程容量，
每轮最多下发 100 次后让出事件循环。归因引擎逐条追加扩展属性，避免大量属性展开为函数参数导致爆栈。

本次优化限制的是调度启动查询和常驻任务内存，不承诺单机百亿事件的处理吞吐。Node 版仍读取完整会话事件列表，
并沿用“最终表存在该切片记录即视为已洗”的判据。独立 Rust 版采用流式批次，并通过 Redis 未完成切片标记覆盖该判据，
部分写入后仍能被重新发现，且只派给 Rust 修复。百亿级持续吞吐还需评估持久任务索引、表排序/投影和数据库集群容量。
无需表迁移；更新并重启总服务即可启用分片调度。

---

## 二、配置速查

### 可选 Rust 独立节点

原 Node 节点及默认启动命令保留，另提供 `apps/final-data-cleaning-rust`。更新总服务后可使用
`yarn start:final-cleaning-rust` 或 `bash scripts/start-final-cleaning-rust.sh` 启动 release 版本。
Rust CPU 池默认使用全部可用 CPU 线程，I/O 任务槽默认是 CPU 池的 4 倍，分别用
`RUST_CLEANING_THREADS` 和 `RUST_TASK_CONCURRENCY` 调整。流式分批读取单会话、按批查重，
不同会话的输出可合批写入；传输默认压缩，监控每秒聚合上报。默认节点 ID 为 `rust-node-<hostname>`、
健康检查端口 10001，可与现有 Node 节点分别接入。Rust 部分写入后的任务只派回 Rust 修复。
完整环境模板、启动参数、失败恢复和验证命令见 [Rust 服务说明](../apps/final-data-cleaning-rust/README.md)。

### 计算节点侧（`final-data-cleaning-service`）

| 变量 | 默认值 | 说明 |
|---|---|---|
| `MASTER_HOST` | `localhost` | 总服务地址。写成 `http://host/` 也可以，会自动去掉协议头 |
| `MASTER_PORT` | `8105` | 总服务的计算节点接入端口（= 总服务的 `NODE_CONTROL_PORT`） |
| `NODE_ID` | 按主机名生成（`node-<hostname>`） | 节点唯一标识。同一机器/容器重启后保持不变；docker/k8s 多副本主机名天然不同可直接留空；**同一台机器起多个进程时务必显式设置不同的值**，否则会互相顶掉会话 |
| `NODE_NAME` | 同 `NODE_ID` | 拓扑图上的展示名 |
| `NODE_ADVERTISE_ADDRESS` | 空 | 节点上报地址，仅用于页面展示节点在哪 |
| `HEARTBEAT_INTERVAL_MS` | `5000` | 心跳间隔（注册帧兼作心跳） |
| `NODE_LOG_FLUSH_INTERVAL_MS` | `2000` | 节点日志上行冲刷间隔（捕获的 console 日志缓冲后经双向流上报总服务） |
| `CLEANING_DETAIL_LOG_ENABLED` | `false` | 逐任务接收、开始、重复跳过、拉取事件、归因和落库完成日志，排查时显式设为 `true` 后重启节点 |
| `PORT` | `10000` | 进程内的 `/health` 监听端口，**不需要对外发布** |

`NODE_ID` / `NODE_NAME` / `CLEANING_DETAIL_LOG_ENABLED` 由节点服务直接读取，其余在 `config/configuration.ts`。

### 总服务侧（`data-dashboard-api-service`）

| 变量 | 默认值 | 说明 |
|---|---|---|
| `NODE_CONTROL_PORT` | `8105` | 计算节点接入的 gRPC 监听端口。跨机器部署时需对外可达 |
| `MASTER_NODE_NAME` | `总服务` | 拓扑图根节点展示名 |
| `HEARTBEAT_TIMEOUT_MS` | `15000` | 超过该时长没收到心跳即判定离线（默认 3 倍于节点 5s 心跳） |
| `CLEANING_DETAIL_LOG_ENABLED` | `false` | 逐任务下发成功日志，排查时显式设为 `true` 后重启总服务 |
| `CLEANING_SCAN_PAGE_SIZE` | `1000` | 每次读取的事件排序键行数，最大 10000；候选任务数不超过该值 |
| `CLEANING_MAX_BUFFERED_TASKS` | `2000` | 已加载的排队与在途任务合计上限，最大 100000；为失败重试预留在途位置 |

最终清洗详情日志默认关闭，关闭后不再打印到控制台或上报节点日志页。任务进度、处理速度和成功率统计继续更新；错误、重试、节点连接状态及调度汇总日志保留。两个服务分别读取各自的 `CLEANING_DETAIL_LOG_ENABLED`，需要完整详情时两侧均设为 `true` 并重启。

### 数据库

节点和总服务都连同一套 MySQL。`compute_node` 表由自动注册写入，并保留离线节点记录，
总服务重启后仍可在「系统数据 → 计算节点」展示已注册的节点。节点调度按上报容量和空闲槽位分配任务，
表中的 `weight` 仅作为兼容字段保留，不参与调度。

| 变量 | 说明 |
|---|---|
| `DB_SYNCHRONIZE` | 设为 `true` 时 TypeORM 自动建表改表，开发 / compose 默认开 |
| 其余 `DB_*` / `CLICKHOUSE_*` / `REDIS_*` / `KAFKA_*` | 与既有清洗链路一致 |

**`DB_SYNCHRONIZE=false` 的存量库需要手工补列**（见下「数据库变更」）。

---

## 三、数据库变更

自动注册用 `compute_node.node_id` 做幂等键，`node_port` 记录声明的健康检查端口。
旧节点可能没有上报端口，因此该列允许为空或为 `0`；它不代表 gRPC 入站端口。

**`DB_SYNCHRONIZE=true` 的环境不用管**（TypeORM 启动时会自己把表对齐到实体）。
**`DB_SYNCHRONIZE=false` 的环境需要手工补**。先看表长什么样再挑对应的语句：

```bash
mysql -h<host> -P<port> -u<user> -p <db> -e "SHOW COLUMNS FROM \`compute_node\`"
```

### 情况 A：缺 `node_id`（表来自旧版 [scripts/create-missing-tables.sql](../scripts/create-missing-tables.sql)）

```sql
ALTER TABLE `compute_node`
  ADD COLUMN `node_id` VARCHAR(100) NULL UNIQUE COMMENT '节点自报标识（自动注册的节点以此字段幂等 upsert）' AFTER `id`,
  MODIFY COLUMN `node_port` INT NULL DEFAULT 0 COMMENT '健康检查端口（未上报时为空或0）';
```

### 情况 B：有 `last_heartbeat` / `capabilities`（表来自旧版 [scripts/init-db.sql](../scripts/init-db.sql)）

这一版 `node_id` 是 `NOT NULL`，与当前实体的可空定义不同；同时缺
`node_address` / `node_port` / `node_type` / `weight` / `description`，而且 `status` 是
`ENUM('online','offline','busy')`——自动注册写 `'running'` 会被截断，必须一并改掉：

```sql
ALTER TABLE `compute_node`
  MODIFY COLUMN `node_id` VARCHAR(100) NULL COMMENT '节点自报标识（自动注册的节点以此字段幂等 upsert）' AFTER `id`,
  ADD COLUMN `node_address` VARCHAR(255) NOT NULL DEFAULT '' COMMENT '节点地址' AFTER `node_name`,
  ADD COLUMN `node_port` INT NULL DEFAULT 0 COMMENT '健康检查端口（未上报时为空或0）' AFTER `node_address`,
  ADD COLUMN `node_type` VARCHAR(20) NOT NULL DEFAULT 'grpc' COMMENT '节点类型（grpc）' AFTER `node_port`,
  ADD COLUMN `weight` INT NOT NULL DEFAULT 100 COMMENT '兼容权重字段（不参与调度）' AFTER `status`,
  ADD COLUMN `description` VARCHAR(255) NULL COMMENT '描述' AFTER `weight`,
  MODIFY COLUMN `node_name` VARCHAR(100) NOT NULL COMMENT '节点名称',
  MODIFY COLUMN `status` VARCHAR(20) NOT NULL DEFAULT 'stopped' COMMENT '节点状态（running/stopped/error）',
  MODIFY COLUMN `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间（自动填充）',
  MODIFY COLUMN `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间（自动更新）';
```

> `last_heartbeat` / `capabilities` 是旧表多出来的列，实体不认。留着无害；
> 但**别在 `DB_SYNCHRONIZE=true` 下启动**——TypeORM 会把实体里没有的列直接 drop 掉。

新建库用 [scripts/create-missing-tables.sql](../scripts/create-missing-tables.sql) 或
[scripts/init-db.sql](../scripts/init-db.sql) 里的 `compute_node` 均可，两份与
[ComputeNode.entity.ts](../libs/shared-utils/src/lib/backend-common/entity/ComputeNode.entity.ts) 已对齐。
改列时请三处同步。

---

## 四、怎么看链接状态

1. **拓扑图（推荐）**：进「系统数据 > 计算节点」。
   - 根节点 = 总服务，子节点 = 已注册的计算节点（含当前离线的，不会凭空消失）。
   - 状态灯：绿=健康空闲、黄=健康忙碌、红=最近一次任务失败、灰=离线（连线变虚线）。
   - 鼠标悬停看链接摘要，点选节点后右侧「节点详情」展开完整信息（链接时长、最近心跳、CPU / 内存、当前任务、最近错误）。
   - 页面每 5 秒自动刷新，也可点右上角刷新按钮。
2. **节点自身健康检查**：`curl http://<节点>:10000/health`

   ```json
   {
     "status": "ok",
     "nodeId": "node-a1b2c3",
     "nodeName": "计算节点1",
     "masterAddr": "data-dashboard-api-service:8105",
     "link": "connected",
     "connectedAt": 1727000000000,
     "lastError": "",
     "currentTaskId": ""
   }
   ```

   `status` 为 `ok` 表示已连上总服务，`degraded` 表示正在重连或连不上。
   （端口只在容器网络内，宿主机上要 `docker exec <容器> curl -s localhost:10000/health`。）
3. **拓扑 API**（与页面同源）：`GET /api/system-data/computing-nodes`
4. **节点日志页**：拓扑页选中节点后点「查看日志」，或 `GET /api/system-data/computing-nodes/:nodeId/logs?limit=100&level=all`。
   节点捕获自身 console / NestJS Logger 输出，按 `NODE_LOG_FLUSH_INTERVAL_MS` 周期经双向流上行，
   总服务落 Redis 有界列表（每节点最近 2000 条、保留 3 天）——节点离线后仍能查到留存的历史日志。
   默认一页 100 条，可选 50 / 100 / 200 条；级别在服务端筛选后分页，信息级别包括 `log` 与 `info`。
   响应提供当前页稳定锚点 `pageCursor`、更早页 `nextCursor` 和 `hasMore`，下一页携带 `cursor=nextCursor`。
   序号和留存周期标识在 Redis 内原子维护，新增日志、同毫秒记录和列表裁剪不会让历史页错位。
   最新页开启跟随后每 3 秒更新；翻历史页自动暂停，只渲染当前页。刷新重读当前锚点，回到最新会清空翻页历史并恢复跟随。
   游标超过留存范围返回 `resetRequired`，页面提示并重新读取最新页；Redis 故障返回 503，页面保留当前页供重试。
5. **自动注册落库**：`compute_node` 保存节点自动注册记录（`description` 为「由计算节点自动注册」），
   拓扑 API 合并实时连接信息和数据库记录，已注册的离线节点仍会展示。

---

## 五、常见故障

| 现象 | 排查 |
|---|---|
| 节点日志反复出现「…ms 后重连总服务」 | `MASTER_HOST` / `MASTER_PORT` 不对，或总服务的 `NODE_CONTROL_PORT` 没对外可达。退避间隔会从 1s 指数增长到 30s，不会刷屏也不会 crash |
| 节点 `/health` 显示 `degraded` | 同上；`lastError` 字段会给出最近一次失败原因 |
| 拓扑图上节点是灰的（离线） | ① 节点进程还在但心跳超时 → 看 `HEARTBEAT_INTERVAL_MS` 与总服务 `HEARTBEAT_TIMEOUT_MS` 是否匹配；② 节点被强杀 → 流没正常关闭，靠心跳超时兜底（最多 15s） |
| 拓扑图上两个节点顶来顶去 / 只剩一个 | 两个节点用了**同一个 `NODE_ID`**，后连上的会作废前一个会话。docker/k8s 留空即可（按各自主机名生成）；同一台机器起多个进程时要显式设置不同的 `NODE_ID` |
| 节点连上后很快被判离线 | 总服务 `HEARTBEAT_TIMEOUT_MS` 小于节点心跳间隔。保持「超时 ≥ 3 倍心跳」 |
| 节点没出现在拓扑图上 | 注册帧缺 `node_id` 会被拒绝（日志有「注册帧缺少 node_id，已拒绝接入」）。检查 `NODE_ID` 是否被显式设成了空串 |
| 页面「最近更新」时间不动 | 前端到 `GET /api/system-data/computing-nodes` 的请求失败，看浏览器网络面板 |
| 改了 `DB_SYNCHRONIZE=false` 后报字段不存在 | 执行上面的 `ALTER TABLE` |

---

## 六、附：协议与代码入口

线上帧定义在 [libs/shared-types/.../enterprise.ts](../libs/shared-types/src/lib/types/request/system-config/enterprise.ts)（`NodeFrame` / `MasterFrame` 等，字段名 `snake_case`），与 proto 消息一一对应。
proto 单一来源在 [libs/shared-utils/.../proto/final_data_cleaning_control_bi_stream.proto](../libs/shared-utils/src/lib/backend-common/proto/final_data_cleaning_control_bi_stream.proto)，两端的 `proto-loader` 选项必须一致（`keepCase: true, longs: String, enums: String, defaults: true, oneofs: true`），否则字段名/默认值会对不上。

| 环节 | 位置 |
|---|---|
| 节点接入客户端（拨出、心跳、重连、日志上行） | [node-connection.service.ts](../apps/final-data-cleaning-service/src/service/node-connection.service.ts) |
| 节点日志捕获缓冲（包装 console，环形缓冲） | [node-log-buffer.ts](../apps/final-data-cleaning-service/src/lib/node-log-buffer.ts) |
| 节点计算本体 | [node.service.ts](../apps/final-data-cleaning-service/src/service/node.service.ts) |
| CPU 归因线程池与 worker 入口 | [attribution-worker-pool.ts](../apps/final-data-cleaning-service/src/lib/attribution-worker-pool.ts)、[attribution-worker.ts](../apps/final-data-cleaning-service/src/lib/attribution-worker.ts) |
| 节点 `/health` | [main.ts](../apps/final-data-cleaning-service/src/main.ts) |
| 总服务在线注册表（含 logs 帧落 Redis、日志查询） | [node-registry.service.ts](../apps/data-dashboard-api-service/src/api/compute-node/node-registry.service.ts) |
| 总服务 gRPC 双向流入口 | [node-control.controller.ts](../apps/data-dashboard-api-service/src/api/compute-node/node-control.controller.ts) |
| 拓扑 / 节点日志查询接口 | [system-data.controller.ts](../apps/data-dashboard-api-service/src/api/system-data/system-data.controller.ts) |
| 节点日志 Redis 有界列表读写 | [node-logs.ts](../libs/shared-utils/src/lib/backend-common/node-logs.ts) |
| 拓扑图页 | [apps/frontend/src/pages/system-data/computing-node](../apps/frontend/src/pages/system-data/computing-node) |
| 节点日志页 | [apps/frontend/src/pages/system-data/computing-node/components/log](../apps/frontend/src/pages/system-data/computing-node/components/log) |
