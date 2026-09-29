# 系统数据总览统计口径

总览不再提供固定示例值。`GET /api/system-data/overview` 聚合以下数据，缓存 15 秒并合并并发请求，页面每 30 秒刷新。所有日、周、月边界使用 Asia/Shanghai，周一为周起点。

| 指标 | 来源与口径 |
| --- | --- |
| 节点在线/离线 | NodeRegistryService 连接与心跳超时状态，包含库中已注册的离线节点 |
| CPU / 内存 | 在线节点心跳；CPU 按核心数加权，内存按容量加权 |
| 平均负载 / 网络 | 在线节点一分钟负载平均值；Linux 非回环网卡 RX+TX 字节增量换算 Gbps，包含虚拟网卡 |
| 数分查询量 | MySQL data_analysis_query_stats 的 query_date，成功和失败执行均计数 |
| 事件收集量 | ClickHouse event_log，按 `$service_time` 的上海日期；这是初步处理后的入库数据 |
| API QPS | 已完成 HTTP 请求数，不包含 /api/system-data/；当前为上一完整分钟平均值，峰值为今日完整分钟最大值，平均为今日采样起点至今 |
| API 响应时间 | 今日请求耗时均值、直方图 P95/P99 桶上界；超过 60000ms 最大桶的分位数返回 null |
| API 请求成功率 | 采样请求中成功的比例；分别展示上一完整分钟及本月，**不是服务在线时长或主动探测可用率** |
| 错误率 | 今日 HTTP 4xx / 5xx / HTTP 成功但业务 code 非 200，互斥计数 |
| 清洗任务成功率 | 今日最终清洗执行成功次数 /（成功 + 失败次数），跳过的重复任务不计数 |
| 实时写入量 | final_event_log 成功写入后采样，按实际写入完成时间统计完整分钟量及今日峰值，历史补算和实际重复写入也计入 |
| 事件存量 | 当前 ClickHouse 表内数量；受保留期影响，不是永久累计值，也不能相除推算清洗成功率 |

无样本、首个不完整分钟、旧节点缺少有效性标志、不支持的平台指标返回 null，UI 显示“—”。真实零值保留为 0。单个数据源失败只影响对应卡片，并返回 warnings；整个请求失败时保留前次结果和数据时间。

## 部署

- 同时更新仪表板 API、前端、最终清洗服务和 shared-types/shared-utils；proto 的新增字段使用新编号，兼容旧节点。旧节点的新增资源指标显示不可用，直到升级并收到有效心跳。
- 无新数据库迁移，无新增必填环境变量。采样复用现有 Redis，API 与计算节点必须使用同一 Redis 实例和 DB；不同部署应隔离 Redis DB。
- Redis 键前缀为 `probe-x:overview:v1:`，按上海自然日聚合，保留 35 天。不保存 URL、用户信息、请求体或凭证。新版本上线前的历史监控数据无法补采。
- Redis 故障期间放弃监控写入，避免阻塞业务或无限排队，并限频记录日志。失败期间可能缺样本；重启保留已成功写入 Redis 的历史。
- 网络速率在 Linux 上通过 `/proc/net/dev` 采集，其他平台显示不可用。没有在线节点时资源指标无样本。
- 当前开发配置的 API `autoRestart` 为 false，修改源码后需要重启 API；计算节点也需重新构建/重启才能发送新增指标。

## 验证

使用 Node 22：

```sh
node --test scripts/system-overview.test.cjs
yarn workspace final-data-cleaning-service test --runInBand
yarn workspace data-dashboard-api-service build
yarn workspace final-data-cleaning-service build
yarn workspace frontend build
```

回归测试涵盖跨日/跨月、自然周、空样本与零吞吐、错误率分母、延迟桶溢出、节点资源加权与旧节点、数据源部分失败、缓存合并、任务去重、落库失败，以及监控异常不影响清洗结果。

## 各服务资源

总览新增“各服务资源”，按服务、主机和实例展示：

- Web 前端开发服务器（Rspack）以及仪表板 API、埋点接收、初步处理、最终清洗四类 Node 服务自动上报。
- 每 10 秒采集，每个进程启动生成独立实例 ID，支持多机、多副本。45 秒未更新或显式停止时标为停止上报，当前资源值显示“—”；记录保留 24 小时。同一主机上被重启取代的已停止实例不再逐条堆叠显示：存在在线实例时只显示在线实例，全部停止时只保留最近一次停止的记录。页面刷新与接口缓存可能带来额外显示延迟。
- 进程 CPU 以一个逻辑核心为 100%，可超过 100%；主机 CPU 以所有逻辑核心为总量，范围为 0–100%。首次采样需要建立 CPU 差分基线，因此显示“—”。
- 进程内存为 RSS，Node 堆内存只展示已使用堆空间；它们不是同一个指标。主机内存、逻辑核心数、1 分钟负载来自服务运行环境，同机实例的主机数据不能相加。容器内不代表 cgroup 配额或容器限额。
- 节点连接状态与资源采样在线状态独立：有资源心跳不代表业务接口一定健康。
- 已知服务从未上报时显示“未接入”。Redis 数据源异常时显示总览警告，不会将不可用服务当成零占用。
- Redis 资源键为 `probe-x:overview:v1:services`（实例索引）和 `probe-x:overview:v1:services:instance:<instanceId>`（快照）。包含主机名、PID 和资源数值，不包含进程命令行、请求数据或凭证。

### 独立 Web/Nginx 等服务接入

前端生产产物由 Nginx 提供静态文件时，浏览器 JavaScript 无法采集服务器 CPU。需要在 Web 服务所在主机或同一 PID 命名空间运行采集器（Node 22、仓库依赖，以及 Linux/macOS 的 `ps`）：

```sh
SERVICE_RESOURCE_ENV_FILE=/path/to/server-only.env \
  node scripts/monitor-service.cjs --service=frontend --pid=<Nginx主进程PID>
```

`--pid` 选择实际 Web 主进程，采集其进程树（包含工作进程）；CPU 由 `ps` 的累计 CPU 时间差计算，精度受系统 `ps` 输出影响，RSS 为进程树求和，可能重复统计共享页。请勿填写采集脚本自身 PID。服务重启后应重启采集器并指定新 PID；部署时可由现有进程管理器负责启动和停止它。

`--service` 可使用其他服务标识；未知标识也会作为独立服务显示。采集器只读取资源，不控制目标进程。

`SERVICE_RESOURCE_ENV_FILE` 是可选的服务端配置路径，支持现有 `REDIS_HOST`、`REDIS_PORT`、`REDIS_DB`、`REDIS_PASSWORD`；未指定时按优先级读取仪表板 API 的 `.env*`。显式环境变量优先。Web 开发采样同样使用此配置，配置只在构建服务器进程中解析，**不写入浏览器 bundle**。

无新增必填配置或数据库迁移。各服务需使用同一个监控 Redis DB，修改采集模块或 Web 构建配置后需要重启对应服务。

资源采样回归：`node --test scripts/service-resources.test.cjs`。
