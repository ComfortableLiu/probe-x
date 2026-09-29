# 通用设置：最终数据清洗定时调度 — 设计

日期：2026-09-29
状态：已确认（2026-09-29 口头确认）

## 背景

最终清洗服务（final-data-cleaning-service）是被动计算节点：自身无任何调度逻辑，收到总服务（data-dashboard-api-service）通过 gRPC 双流下发的 `ComputeTask{ task_id, session_id, date }` 才执行清洗。总服务侧的下发通道 `NodeRegistryService.dispatchTask()`（`apps/data-dashboard-api-service/src/api/compute-node/node-registry.service.ts:205`）目前**没有任何调用方**——即"什么时候清洗"这一环完全缺失。

本需求：在系统设置中新增「通用设置」，可配置每天几点进行最终数据清洗（清洗昨天的数据），并提供「立即清洗」手动触发。

## 决策记录（已与用户确认）

- 调度形式：**每天固定时间**，到点清洗（时间选择器，`HH:mm`）
- 同时提供**「立即清洗」手动触发**按钮
- 前端落点：新建 `system-config/general` 子页面（不复用 system-params 占位页）

## 1. 配置存储

新建通用 KV 表 `system_config`：

| 列 | 类型 | 说明 |
|---|---|---|
| `key` | varchar(100) PK | 配置键 |
| `value` | text | 配置值 |
| `description` | varchar(500) | 描述 |
| `updated_at` | datetime | 更新时间 |

实体放 `libs/shared-utils/src/lib/backend-common/entity/SystemConfig.entity.ts` 并在 `entity/index.ts` 导出（MysqlModule 的 `extractEntities()` 自动收集注册，无需改 datasource 配置）。

生产环境 `DB_SYNCHRONIZE=false`，必须同步补手工建表 SQL：`scripts/init-db.sql` 和 `scripts/create-missing-tables.sql`。

通用设置的 key：

- `final_cleaning.enabled`：`true` / `false`，默认 `false`
- `final_cleaning.daily_time`：`HH:mm`，默认 `02:00`

## 2. 调度器（总服务）

新增 `CleaningSchedulerService`，挂在 compute-node 模块（`apps/data-dashboard-api-service/src/api/compute-node/`）：

- 裸 `setInterval` 每分钟检查一次（对齐仓库现有定时器风格，不引入 `@nestjs/schedule`）
- 触发条件：`final_cleaning.enabled === 'true'` 且当前时间已过当天 `daily_time` 且今天尚未执行过（执行记录用 Redis 键 `clean:scheduler:last_run_date` 持久化，防重启重复触发）
- 触发时枚举**所有欠账**（而非只枚举昨天），保证失败/停机自愈。注意按 (date, session) 对去重——同一 session 跨天时，已洗过的日期切片跳过、未洗的仍会被捞到：

  ```sql
  SELECT DISTINCT `$session_id` AS session_id, toDate(`$service_time`) AS date
  FROM event_log
  WHERE toDate(`$service_time`) <= yesterday
    AND (toDate(`$service_time`), `$session_id`) NOT IN (
      SELECT toDate(`$service_time`), `$session_id` FROM final_event_log
      WHERE toDate(`$service_time`) <= yesterday
    )
  ```

  （`event_log` 按月分区、排序键首列 `$service_time`、`$session_id` 有 bloom_filter 索引，见 `scripts/init-clickhouse.sql`）

- 每个 (date, session) 生成确定性 `task_id = clean:{date}:{sessionId}`，失败重试加 `:r{n}` 后缀（`n` 从 1 递增）
- 节点选择：从 `NodeRegistryService` 选**在线且空闲**（无 busy_task_id）的节点逐个下发；无可用节点时本轮任务排队等下一轮检查
- 失败的 session 记录日志；因枚举逻辑是"所有欠账"，次日会自动重捞，不需要调度器内做复杂重试状态机

## 3. 后端接口（system-config 模块，AdminGuard）

- `GET /system-config/general` → `{ enabled: boolean, dailyTime: 'HH:mm' }`
- `PUT /system-config/general`，body 同上 → 写 `system_config` 表
- `POST /system-config/general/clean-now`，body 可选 `{ date?: 'YYYY-MM-DD' }`：
  - 指定日期：清洗该日期的欠账 session
  - 不指定：与定时触发同一条链路（枚举 ≤ 昨天的全部欠账）

类型定义加在 `libs/shared-types`（参考现有 `IQuerySystemListReq` 等模式）。

## 4. 前端「通用设置」页

新建 `apps/frontend/src/pages/system-config/general/`，标准四件套：

- `index.tsx`：页面 = PageHeader + 描述 + 裸 antd `Form`（**不**用 FormComponent，它是筛选条组件，变更即提交）
  - 启用开关（Switch）
  - 每日清洗时间（TimePicker，格式 `HH:mm`）
  - 「保存」按钮 → PUT 接口
  - 「立即清洗」按钮 + 可选 DatePicker（不选 = 补全部欠账）→ POST clean-now，触发后 message 提示
- `services.ts` / `model.ts` / `type.ts`：按 computing-node 页的 Rematch 模式
- 路由：`apps/frontend/src/router/page/SystemConfig.tsx` children 加一项（菜单自动从路由生成）
- model 注册：`apps/frontend/src/store/models/index.ts` 的 `RootModel` 接口 + `models` 对象
- 权限：不新增权限点，走 RouteGuard 对 `/system-config/*` 的既有 fallback

## 5. 幂等与已知限制

- 节点侧已有 Redis 幂等键 `clean:task:{task_id}`（24h TTL，`node.service.ts:74-89`）；确定性 task_id 让同一天的重复触发天然跳过
- **失败任务的坑**：NX 键在任务开始时写入、失败不删除，24h 内用同一 task_id 重试会被误判为已完成 → 所以重试必须换 `:r{n}` 后缀
- **`final_event_log` 是 MergeTree 不去重**（`init-clickhouse.sql:104-105` 注释明确幂等完全靠 Redis 键）：重洗同一 session 会产生重复行，因此枚举一律跳过已在 `final_event_log` 中的 session；「立即清洗」对已洗过的 session 同样跳过。若确需重洗，需先手工清理 `final_event_log` 对应数据
- 节点侧（final-data-cleaning-service）**零改动**

## 6. 验证方式

无后端单测框架覆盖 api 服务，采用手动验证：

1. 保存设置：把时间设为当前时间 2 分钟后，观察调度器日志输出"开始触发"
2. 「立即清洗」按钮：触发后观察计算节点状态变 busy、`final_event_log` 出现数据、节点日志推进度
3. 重复触发同一天：确认幂等跳过（节点日志"重复任务跳过"）
4. 前端页面：保存后刷新，设置正确回显

## 涉及文件清单

**新建**：
- `libs/shared-utils/src/lib/backend-common/entity/SystemConfig.entity.ts`
- `apps/data-dashboard-api-service/src/api/compute-node/cleaning-scheduler.service.ts`
- `apps/data-dashboard-api-service/src/api/system-config/general-config.service.ts`
- `apps/frontend/src/pages/system-config/general/`（index.tsx / type.ts / services.ts / model.ts / styles.module.scss）

**修改**：
- `libs/shared-utils/src/lib/backend-common/entity/index.ts`（导出新实体）
- `libs/shared-types`（新增请求/响应类型）
- `apps/data-dashboard-api-service/src/api/system-config/system-config.controller.ts`（3 个接口）
- `apps/data-dashboard-api-service/src/api/system-config/system-config.module.ts`（注册 service + 实体）
- `apps/data-dashboard-api-service/src/api/compute-node/compute-node.module.ts`（注册调度器）
- `apps/data-dashboard-api-service/src/api/compute-node/node-registry.service.ts`（如需新增"选在线空闲节点"方法，如 `pickIdleNode()`）
- `scripts/init-db.sql`、`scripts/create-missing-tables.sql`（建表 SQL）
- `apps/frontend/src/router/page/SystemConfig.tsx`（路由）
- `apps/frontend/src/store/models/index.ts`（model 注册）
