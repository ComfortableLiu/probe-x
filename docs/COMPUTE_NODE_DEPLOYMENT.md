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
     │  上行：NodeRegister（注册/心跳/NodeInfo）· ProgressUpdate              │
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

多起几个节点：换一个 `--name` 和 `NODE_NAME` 即可（**不要**给它们同一个 `NODE_ID`，留空会各自随机生成）。

### 方式 2：`docker compose` 同栈扩容

compose 里已经配好接入参数，节点服务**不发布端口**、**不设 `container_name`**，可以直接横向扩容：

```bash
docker compose up -d --build
docker compose up -d --scale final-data-cleaning-service=3
```

3 个副本会各自生成 `NODE_ID`，在拓扑图上是 3 个独立的子节点。
它们会共用 `COMPUTE_NODE_NAME`（默认「计算节点」），想区分的话在 `.env` 里设 `COMPUTE_NODE_NAME`，或改用方式 1 / 方式 3 按副本指定 `NODE_NAME`。

### 方式 3：本地开发

```bash
MASTER_HOST=localhost MASTER_PORT=8105 \
NODE_NAME=本地计算节点 \
yarn start:final-cleaning
```

前提是总服务已在本地跑起来（`yarn start:dashboard-api`），并且 MySQL / ClickHouse / Redis 可达。

---

## 二、配置速查

### 计算节点侧（`final-data-cleaning-service`）

| 变量 | 默认值 | 说明 |
|---|---|---|
| `MASTER_HOST` | `localhost` | 总服务地址。写成 `http://host/` 也可以，会自动去掉协议头 |
| `MASTER_PORT` | `8105` | 总服务的计算节点接入端口（= 总服务的 `NODE_CONTROL_PORT`） |
| `NODE_ID` | 随机生成 | 节点唯一标识。**多副本部署务必留空**（或各副本不同），否则会互相顶掉会话 |
| `NODE_NAME` | 同 `NODE_ID` | 拓扑图上的展示名 |
| `NODE_ADVERTISE_ADDRESS` | 空 | 节点上报地址，仅用于页面展示节点在哪 |
| `HEARTBEAT_INTERVAL_MS` | `5000` | 心跳间隔（注册帧兼作心跳） |
| `PORT` | `10000` | 进程内的 `/health` 监听端口，**不需要对外发布** |

`NODE_ID` / `NODE_NAME` 在 `ComputeNodeService` 中读取，其余在 `config/configuration.ts`。

### 总服务侧（`data-dashboard-api-service`）

| 变量 | 默认值 | 说明 |
|---|---|---|
| `NODE_CONTROL_PORT` | `8105` | 计算节点接入的 gRPC 监听端口。跨机器部署时需对外可达 |
| `MASTER_NODE_NAME` | `总服务` | 拓扑图根节点展示名 |
| `HEARTBEAT_TIMEOUT_MS` | `15000` | 超过该时长没收到心跳即判定离线（默认 3 倍于节点 5s 心跳） |

### 数据库

节点和总服务都连同一套 MySQL。`compute_node` 表由自动注册写入：

| 变量 | 说明 |
|---|---|
| `DB_SYNCHRONIZE` | 设为 `true` 时 TypeORM 自动建表改表，开发 / compose 默认开 |
| 其余 `DB_*` / `CLICKHOUSE_*` / `REDIS_*` / `KAFKA_*` | 与既有清洗链路一致 |

**`DB_SYNCHRONIZE=false` 的存量库需要手工补列**（见下「数据库变更」）。

---

## 三、数据库变更

自动注册用 `compute_node.node_id` 做幂等键，拨出接入的节点没有监听端口所以 `node_port` 放开为空。

**`DB_SYNCHRONIZE=true` 的环境不用管**（TypeORM 启动时会自己把表对齐到实体）。
**`DB_SYNCHRONIZE=false` 的环境需要手工补**。先看表长什么样再挑对应的语句：

```bash
mysql -h<host> -P<port> -u<user> -p <db> -e "SHOW COLUMNS FROM \`compute_node\`"
```

### 情况 A：缺 `node_id`（表来自旧版 [scripts/create-missing-tables.sql](../scripts/create-missing-tables.sql)）

```sql
ALTER TABLE `compute_node`
  ADD COLUMN `node_id` VARCHAR(100) NULL UNIQUE COMMENT '节点自报标识（自动注册的节点以此字段幂等 upsert）' AFTER `id`,
  MODIFY COLUMN `node_port` INT NULL DEFAULT 0 COMMENT '节点端口（拨出接入的计算节点无监听端口，允许为空）';
```

### 情况 B：有 `last_heartbeat` / `capabilities`（表来自旧版 [scripts/init-db.sql](../scripts/init-db.sql)）

这一版 `node_id` 是 `NOT NULL`（手工登记的节点没有自报 id，会被拒写）、缺
`node_address` / `node_port` / `node_type` / `weight` / `description`，而且 `status` 是
`ENUM('online','offline','busy')`——自动注册写 `'running'` 会被截断，必须一并改掉：

```sql
ALTER TABLE `compute_node`
  MODIFY COLUMN `node_id` VARCHAR(100) NULL COMMENT '节点自报标识（自动注册的节点以此字段幂等 upsert）' AFTER `id`,
  ADD COLUMN `node_address` VARCHAR(255) NOT NULL DEFAULT '' COMMENT '节点地址' AFTER `node_name`,
  ADD COLUMN `node_port` INT NULL DEFAULT 0 COMMENT '节点端口（拨出接入的计算节点无监听端口，允许为空）' AFTER `node_address`,
  ADD COLUMN `node_type` VARCHAR(20) NOT NULL DEFAULT 'grpc' COMMENT '节点类型（grpc）' AFTER `node_port`,
  ADD COLUMN `weight` INT NOT NULL DEFAULT 100 COMMENT '权重（用于负载均衡，默认100）' AFTER `status`,
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
4. **自动注册落库**：`GET /api/compute-node/list` 能看到自动生成的记录（`description` 为「由计算节点自动注册」）。

---

## 五、常见故障

| 现象 | 排查 |
|---|---|
| 节点日志反复出现「…ms 后重连总服务」 | `MASTER_HOST` / `MASTER_PORT` 不对，或总服务的 `NODE_CONTROL_PORT` 没对外可达。退避间隔会从 1s 指数增长到 30s，不会刷屏也不会 crash |
| 节点 `/health` 显示 `degraded` | 同上；`lastError` 字段会给出最近一次失败原因 |
| 拓扑图上节点是灰的（离线） | ① 节点进程还在但心跳超时 → 看 `HEARTBEAT_INTERVAL_MS` 与总服务 `HEARTBEAT_TIMEOUT_MS` 是否匹配；② 节点被强杀 → 流没正常关闭，靠心跳超时兜底（最多 15s） |
| 拓扑图上两个节点顶来顶去 / 只剩一个 | 两个节点用了**同一个 `NODE_ID`**，后连上的会作废前一个会话。把 `NODE_ID` 留空让它们各自生成 |
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
| 节点接入客户端（拨出、心跳、重连） | [node-connection.service.ts](../apps/final-data-cleaning-service/src/service/node-connection.service.ts) |
| 节点计算本体 | [node.service.ts](../apps/final-data-cleaning-service/src/service/node.service.ts) |
| 节点 `/health` | [main.ts](../apps/final-data-cleaning-service/src/main.ts) |
| 总服务在线注册表 | [node-registry.service.ts](../apps/data-dashboard-api-service/src/api/compute-node/node-registry.service.ts) |
| 总服务 gRPC 双向流入口 | [node-control.controller.ts](../apps/data-dashboard-api-service/src/api/compute-node/node-control.controller.ts) |
| 拓扑查询接口 | [system-data.controller.ts](../apps/data-dashboard-api-service/src/api/system-data/system-data.controller.ts) |
| 拓扑图页 | [apps/frontend/src/pages/system-data/computing-node](../apps/frontend/src/pages/system-data/computing-node) |
