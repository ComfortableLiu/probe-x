# 最终数据清洗定时调度 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在系统设置中新增「通用设置」页，配置每天几点进行最终数据清洗（清洗昨天及以前的欠账数据），并支持「立即清洗」手动触发。

**Architecture:** 配置存 MySQL 新 KV 表 `system_config`；总服务（data-dashboard-api-service）compute-node 模块内新增 `CleaningSchedulerService`，每分钟 tick 检查是否到点，到点则枚举 ClickHouse `event_log` 中未清洗的 (date, session)，生成确定性 task_id 后经 `NodeRegistryService.dispatchTask` 下发给在线空闲节点；前端新增 `system-config/general` 页面。

**Tech Stack:** NestJS 11 + TypeORM + ioredis + @clickhouse/client（后端）；React + antd 5 + Rematch（前端）。

**Spec:** `docs/superpowers/specs/2026-09-29-final-cleaning-schedule-design.md`

## Global Constraints

- 代码风格：2 空格缩进、无分号、多行结构尾逗号（项目 ESLint）。
- 不引入 `@nestjs/schedule`——定时器用裸 `setInterval`，对齐 `node-registry.service.ts` 既有风格。
- 生产 `DB_SYNCHRONIZE=false`，新增表必须同时写进 `scripts/init-db.sql` 和 `scripts/create-missing-tables.sql`。
- 已清洗过的 (date, session) 一律跳过（`final_event_log` 是 MergeTree 不去重，重洗会产生重复行）。
- task_id 规则：`clean:{runDate}:{taskDate}:{sessionId}`，同日失败重试追加 `:r{n}`（n 从 1 递增）。
- final-data-cleaning-service（节点侧）零改动。
- 提交信息用 Conventional Commits（`feat:` / `fix:`），对齐仓库历史。

---

### Task 1: 配置存储（SystemConfig 实体 + 建表 SQL + 共享类型）

**Files:**
- Create: `libs/shared-utils/src/lib/backend-common/entity/SystemConfig.entity.ts`
- Modify: `libs/shared-utils/src/lib/backend-common/entity/index.ts`（追加一行导出）
- Modify: `scripts/init-db.sql`（在 sync_cursor 表之后追加建表 SQL）
- Modify: `scripts/create-missing-tables.sql`（文件末尾追加同款建表 SQL）
- Modify: `libs/shared-types/src/lib/types/request/system-config/enterprise.ts`（文件末尾追加类型）

**Interfaces:**
- Produces:
  - `SystemConfigEntity`（TypeORM 实体，表 `system_config`，字段 `key` / `value` / `description` / `updatedAt`）
  - 类型 `IGeneralConfig` / `IUpdateGeneralConfigReq` / `ICleanNowReq` / `ICleanNowRes`（从 `@probe-x/shared-types/src` 导出，barrel 已 `export * from "./system-config/enterprise"`，无需改 barrel）

- [ ] **Step 1: 创建实体**

创建 `libs/shared-utils/src/lib/backend-common/entity/SystemConfig.entity.ts`：

```ts
import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm'

/**
 * 通用配置表（KV 形态，一行一个配置项）
 *
 * 当前用于最终数据清洗调度（final_cleaning.enabled / final_cleaning.daily_time），
 * 后续其他全局运行参数也放这里。
 */
@Entity('system_config', {
  comment: '通用配置表：一行一个全局配置项',
})
export class SystemConfigEntity {

  /**
   * 配置键，如 final_cleaning.daily_time
   */
  @PrimaryColumn({
    type: 'varchar',
    length: 100,
    name: 'key',
    comment: '配置键，如 final_cleaning.daily_time',
  })
  key?: string

  /**
   * 配置值
   */
  @Column({
    type: 'text',
    name: 'value',
    nullable: true,
    comment: '配置值',
  })
  value?: string

  @Column({
    type: 'varchar',
    length: 500,
    name: 'description',
    default: '',
    comment: '配置描述',
  })
  description?: string

  @UpdateDateColumn({
    name: 'updated_at',
    comment: '更新时间',
    type: 'datetime',
    default: () => 'CURRENT_TIMESTAMP(3)',
  })
  updatedAt?: Date
}
```

在 `libs/shared-utils/src/lib/backend-common/entity/index.ts` 末尾追加：

```ts
export * from './SystemConfig.entity'
```

（MysqlModule 的 `extractEntities()` 通过该 barrel 自动收集实体，无需改 datasource 配置。）

- [ ] **Step 2: 补建表 SQL**

在 `scripts/init-db.sql` 的 `sync_cursor` 建表语句之后、`-- ==================== 初始化数据 ====================` 之前插入：

```sql
-- ==================== 通用配置表 ====================
-- 通用 KV 形态：一行一个全局配置项，当前用于最终数据清洗调度（final_cleaning.*）。
CREATE TABLE IF NOT EXISTS `system_config` (
  `key` VARCHAR(100) PRIMARY KEY COMMENT '配置键，如 final_cleaning.daily_time',
  `value` TEXT NULL COMMENT '配置值',
  `description` VARCHAR(500) NOT NULL DEFAULT '' COMMENT '配置描述',
  `updated_at` DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='通用配置表：一行一个全局配置项';
```

同款语句追加到 `scripts/create-missing-tables.sql` 文件末尾。

- [ ] **Step 3: 追加共享类型**

在 `libs/shared-types/src/lib/types/request/system-config/enterprise.ts` 文件末尾追加：

```ts
/**
 * 通用设置（最终数据清洗调度）
 */
export interface IGeneralConfig {
  /** 是否启用每日定时清洗 */
  enabled: boolean
  /** 每日清洗时间，HH:mm 格式，如 02:00 */
  dailyTime: string
}

/**
 * 更新通用设置请求
 */
export type IUpdateGeneralConfigReq = IGeneralConfig

/**
 * 立即清洗请求
 */
export interface ICleanNowReq {
  /** 指定清洗日期 YYYY-MM-DD；不传则清洗全部欠账（≤昨天且未清洗的 session） */
  date?: string
}

/**
 * 立即清洗响应
 */
export interface ICleanNowRes {
  /** 本次实际下发到节点的任务数 */
  dispatched: number
  /** 排队等待空闲节点的任务数 */
  pending: number
}
```

- [ ] **Step 4: 构建共享库验证编译**

Run: `yarn build:lib`
Expected: 两个 lib 包构建成功，无 TS 错误。

- [ ] **Step 5: Commit**

```bash
git add libs/shared-utils/src/lib/backend-common/entity/SystemConfig.entity.ts libs/shared-utils/src/lib/backend-common/entity/index.ts scripts/init-db.sql scripts/create-missing-tables.sql libs/shared-types/src/lib/types/request/system-config/enterprise.ts
git commit -m "feat: 新增 system_config 通用配置表与通用设置类型"
```

---

### Task 2: 通用设置读写接口（后端）

**Files:**
- Create: `apps/data-dashboard-api-service/src/api/system-config/general-config.service.ts`
- Modify: `apps/data-dashboard-api-service/src/api/system-config/system-config.controller.ts`（加 import + 构造函数注入 + 3 个端点）
- Modify: `apps/data-dashboard-api-service/src/api/system-config/system-config.module.ts`（注册实体与 service，import ComputeNodeModule）

**Interfaces:**
- Consumes: Task 1 的 `SystemConfigEntity`、`IGeneralConfig`、`IUpdateGeneralConfigReq`
- Produces:
  - `GET /system-config/general` → `IGeneralConfig`
  - `PUT /system-config/general`，body `IUpdateGeneralConfigReq` → `IGeneralConfig`（保存后的值）
  - `GeneralConfigService.getGeneralConfig(): Promise<IGeneralConfig>` / `updateGeneralConfig(config): Promise<void>`

- [ ] **Step 1: 创建 GeneralConfigService**

创建 `apps/data-dashboard-api-service/src/api/system-config/general-config.service.ts`：

```ts
import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { SystemConfigEntity } from '@probe-x/shared-utils/src/lib/backend-common'
import { IGeneralConfig, IUpdateGeneralConfigReq } from '@probe-x/shared-types/src'

export const GENERAL_CONFIG_KEYS = {
  enabled: 'final_cleaning.enabled',
  dailyTime: 'final_cleaning.daily_time',
} as const

const DEFAULT_DAILY_TIME = '02:00'

@Injectable()
export class GeneralConfigService {
  constructor(
    @InjectRepository(SystemConfigEntity)
    private readonly repo: Repository<SystemConfigEntity>,
  ) {}

  async getGeneralConfig(): Promise<IGeneralConfig> {
    const rows = await this.repo.find({
      where: [{ key: GENERAL_CONFIG_KEYS.enabled }, { key: GENERAL_CONFIG_KEYS.dailyTime }],
    })
    const map = new Map(rows.map(row => [row.key, row.value]))
    const dailyTime = map.get(GENERAL_CONFIG_KEYS.dailyTime)
    return {
      enabled: map.get(GENERAL_CONFIG_KEYS.enabled) === 'true',
      dailyTime: dailyTime && /^\d{2}:\d{2}$/.test(dailyTime) ? dailyTime : DEFAULT_DAILY_TIME,
    }
  }

  async updateGeneralConfig(config: IUpdateGeneralConfigReq): Promise<void> {
    await this.repo.save([
      { key: GENERAL_CONFIG_KEYS.enabled, value: String(config.enabled), description: '最终数据清洗：是否启用每日定时清洗' },
      { key: GENERAL_CONFIG_KEYS.dailyTime, value: config.dailyTime, description: '最终数据清洗：每日清洗时间（HH:mm）' },
    ])
  }
}
```

- [ ] **Step 2: 控制器加读写端点**

`system-config.controller.ts`：

1. import 区追加：

```ts
import { Put } from '@nestjs/common'
```

（`@nestjs/common` 那行已有 `Body, Controller, Get, Post, Query, UseGuards`，把 `Put` 加进去。）

2. shared-types import 列表追加：`IGeneralConfig, IUpdateGeneralConfigReq`。

3. 追加 import：

```ts
import { GeneralConfigService } from './general-config.service'
```

4. 构造函数注入：

```ts
  constructor(
    private readonly userService: SystemConfigUserService,
    private readonly roleService: SystemConfigRoleService,
    private readonly systemService: SystemConfigSystemService,
    private readonly generalConfigService: GeneralConfigService,
  ) {}
```

5. 类内追加两个端点（放在最后一个端点之后）：

```ts
  /**
   * 获取通用设置
   */
  @Get('general')
  async getGeneralConfig(): Promise<IGeneralConfig> {
    return this.generalConfigService.getGeneralConfig()
  }

  /**
   * 保存通用设置
   */
  @Put('general')
  async updateGeneralConfig(@Body() body: IUpdateGeneralConfigReq): Promise<IGeneralConfig> {
    await this.generalConfigService.updateGeneralConfig(body)
    return this.generalConfigService.getGeneralConfig()
  }
```

（`clean-now` 端点依赖 Task 3 的调度器，在 Task 3 Step 7 再加。）

- [ ] **Step 3: 模块注册**

`system-config.module.ts`：

```ts
import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ConfigModule } from '@nestjs/config'
import { SystemConfigController } from './system-config.controller'
import { SystemConfigUserService } from './user.service'
import { SystemConfigRoleService } from './role.service'
import { SystemConfigSystemService } from './system.service'
import { GeneralConfigService } from './general-config.service'
import { UserEntity } from '@probe-x/shared-utils/src/lib/backend-common/entity/User.entity'
import { UserRoleRelation } from '@probe-x/shared-utils/src/lib/backend-common/entity/UserRoleRelation.entity'
import { Role } from '@probe-x/shared-utils/src/lib/backend-common/entity/Role.entity'
import { Permission } from '@probe-x/shared-utils/src/lib/backend-common/entity/Permission.entity'
import { RolePermissionRelation } from '@probe-x/shared-utils/src/lib/backend-common/entity/RolePermissionRelation.entity'
import { System } from '@probe-x/shared-utils/src/lib/backend-common/entity/System.entity'
import { TrackingNodeEntity } from '@probe-x/shared-utils/src/lib/backend-common/entity/TrackingNode.entity'
import { SystemConfigEntity } from '@probe-x/shared-utils/src/lib/backend-common/entity/SystemConfig.entity'
import { AdminGuard } from '../../guard/admin.guard'

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity, UserRoleRelation, Role, Permission, RolePermissionRelation, System, TrackingNodeEntity, SystemConfigEntity]),
    ConfigModule,
  ],
  controllers: [SystemConfigController],
  providers: [SystemConfigUserService, SystemConfigRoleService, SystemConfigSystemService, GeneralConfigService, AdminGuard],
  exports: [SystemConfigUserService, SystemConfigRoleService, SystemConfigSystemService, GeneralConfigService],
})
export class SystemConfigModule {}
```

（Task 3 会再改一次本文件，引入 ComputeNodeModule 支持 clean-now。）

- [ ] **Step 4: 构建 api 服务确认编译**

Run: `yarn workspace data-dashboard-api-service build`
Expected: 构建成功（仅既有的 2 条 RedisModuleOptions warning）。

- [ ] **Step 5: Commit**

```bash
git add apps/data-dashboard-api-service/src/api/system-config/general-config.service.ts apps/data-dashboard-api-service/src/api/system-config/system-config.controller.ts apps/data-dashboard-api-service/src/api/system-config/system-config.module.ts
git commit -m "feat: 系统设置新增通用设置读写接口"
```

---

### Task 3: 清洗调度器（核心）

**Files:**
- Modify: `apps/data-dashboard-api-service/src/api/compute-node/node-registry.service.ts`（加 `pickIdleNode()` + 任务落定监听）
- Create: `apps/data-dashboard-api-service/src/api/compute-node/cleaning-scheduler.service.ts`
- Modify: `apps/data-dashboard-api-service/src/api/compute-node/compute-node.module.ts`（注册/导出调度器，import ClickHouseModule + SystemConfigEntity）
- Test: `scripts/cleaning-scheduler.test.cjs`

**Interfaces:**
- Consumes: `NodeRegistryService.dispatchTask(nodeId, task): boolean`（已存在，`node-registry.service.ts:205`）；`ClickHouseService.query<T>(sql, params)`（`libs/shared-utils/src/lib/backend-common/modules/clickhouse/clickhouse.service.ts:20`）；`RedisService.get/set`（`redis.service.ts:94,102`）；Task 1 的 `SystemConfigEntity`、`ComputeTask`（`enterprise.ts:310`）
- Produces:
  - `NodeRegistryService.pickIdleNode(): string | null`
  - `NodeRegistryService.onTaskSettled(listener: (taskId: string, failed: boolean) => void): void`
  - `CleaningSchedulerService.cleanNow(date?: string): Promise<ICleanNowRes>`
  - 纯函数 `buildTaskId(runDate, taskDate, sessionId, attempt?): string`、`planCleaningTasks(rows, runDate): ComputeTask[]`（供单测）

- [ ] **Step 1: 写失败的测试**

创建 `scripts/cleaning-scheduler.test.cjs`（风格对齐 `scripts/service-resources.test.cjs`）：

```js
const assert = require('node:assert/strict')
const { test } = require('node:test')
require('reflect-metadata')
require('ts-node').register({ transpileOnly: true, skipProject: true, compilerOptions: {
  target: 'ES2022', module: 'CommonJS', moduleResolution: 'node', experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true,
} })
const { buildTaskId, planCleaningTasks } = require('../apps/data-dashboard-api-service/src/api/compute-node/cleaning-scheduler.service.ts')

test('task_id 确定性生成，重试追加 :r{n} 后缀', () => {
  assert.equal(buildTaskId('2026-09-29', '2026-09-28', 's-1'), 'clean:2026-09-29:2026-09-28:s-1')
  assert.equal(buildTaskId('2026-09-29', '2026-09-28', 's-1', 2), 'clean:2026-09-29:2026-09-28:s-1:r2')
})

test('planCleaningTasks 为每个 (date, session) 生成任务并去重', () => {
  const rows = [
    { session_id: 's-1', date: '2026-09-28' },
    { session_id: 's-2', date: '2026-09-28' },
    { session_id: 's-1', date: '2026-09-28' },
  ]
  const tasks = planCleaningTasks(rows, '2026-09-29')
  assert.equal(tasks.length, 2)
  assert.deepEqual(tasks[0], { task_id: 'clean:2026-09-29:2026-09-28:s-1', session_id: 's-1', date: '2026-09-28' })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test scripts/cleaning-scheduler.test.cjs`
Expected: FAIL（模块不存在，Cannot find module）

- [ ] **Step 3: NodeRegistryService 增加选节点与落定监听**

`node-registry.service.ts`：

1. 类字段区（`private readonly nodes` 附近）追加：

```ts
  private readonly settleListeners: Array<(taskId: string, failed: boolean) => void> = []
```

2. `dispatchTask` 方法之后追加两个公开方法：

```ts
  /**
   * 挑选一个在线且空闲的节点，无可用节点返回 null
   */
  pickIdleNode(): string | null {
    const now = Date.now()
    for (const node of this.nodes.values()) {
      if (this.isAlive(node, now) && !node.busy) return node.nodeId
    }
    return null
  }

  /**
   * 任务落定（完成或失败）时回调，供调度器立刻补发排队任务
   */
  onTaskSettled(listener: (taskId: string, failed: boolean) => void): void {
    this.settleListeners.push(listener)
  }
```

3. `applyProgress` 方法中，在 `progress.failed` 分支的 `return` 之前、`progress.completed` 分支的 `return` 之前，各加一行通知：

```ts
    if (progress.failed) {
      node.busy = false
      node.busyTaskId = ''
      node.lastError = progress.error || '任务执行失败'
      this.settleListeners.forEach(listener => listener(progress.task_id, true))
      return
    }
    if (progress.completed) {
      node.busy = false
      node.busyTaskId = ''
      // 任务跑成功即代表上次失败已成过去，红灯不应常亮
      node.lastError = ''
      this.settleListeners.forEach(listener => listener(progress.task_id, false))
      return
    }
```

- [ ] **Step 4: 实现 CleaningSchedulerService**

创建 `apps/data-dashboard-api-service/src/api/compute-node/cleaning-scheduler.service.ts`：

```ts
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import dayjs from 'dayjs'
import { ClickHouseService, RedisService, SystemConfigEntity } from '@probe-x/shared-utils/src/lib/backend-common'
import { ComputeTask, ICleanNowRes } from '@probe-x/shared-types/src'
import { NodeRegistryService } from './node-registry.service'

/** 调度检查间隔 */
const TICK_INTERVAL_MS = 60000
/** 记录今天是否已定时触发过（防重启重复触发） */
const LAST_RUN_KEY = 'clean:scheduler:last_run_date'
/** 同一任务同日最多重试次数 */
const MAX_ATTEMPTS = 2

const CONFIG_KEY_ENABLED = 'final_cleaning.enabled'
const CONFIG_KEY_DAILY_TIME = 'final_cleaning.daily_time'
const DEFAULT_DAILY_TIME = '02:00'

interface BacklogRow {
  session_id: string
  date: string
}

/**
 * 生成确定性 task_id：同一天内重发天然命中节点侧 Redis 幂等键；
 * 跨天重发换 runDate，避免失败任务的残留幂等键（24h TTL）挡住次日的补洗
 */
export function buildTaskId(runDate: string, taskDate: string, sessionId: string, attempt = 0): string {
  const base = `clean:${runDate}:${taskDate}:${sessionId}`
  return attempt > 0 ? `${base}:r${attempt}` : base
}

/** 把欠账行展开成任务列表（按 task_id 去重） */
export function planCleaningTasks(rows: BacklogRow[], runDate: string): ComputeTask[] {
  const seen = new Set<string>()
  const tasks: ComputeTask[] = []
  for (const row of rows) {
    const taskId = buildTaskId(runDate, row.date, row.session_id)
    if (seen.has(taskId)) continue
    seen.add(taskId)
    tasks.push({ task_id: taskId, session_id: row.session_id, date: row.date })
  }
  return tasks
}

/**
 * 最终数据清洗调度器
 *
 * 每分钟检查一次：到点（启用且已过当天配置时间且今天未跑过）则枚举欠账并下发。
 * 手动 cleanNow 与定时触发共用同一条枚举+下发链路。
 * 枚举范围是「所有欠账」而非只昨天：失败或停机次日自动补洗，自愈。
 */
@Injectable()
export class CleaningSchedulerService implements OnModuleInit, OnModuleDestroy {
  private timer: ReturnType<typeof setInterval> | null = null
  /** 待下发队列（task_id 即队列元素） */
  private queue: ComputeTask[] = []
  /** task_id -> 已尝试次数，失败重试用 :r{n} 后缀 */
  private readonly attempts = new Map<string, number>()
  private draining = false

  constructor(
    private readonly registry: NodeRegistryService,
    private readonly clickhouseService: ClickHouseService,
    private readonly redisService: RedisService,
    @InjectRepository(SystemConfigEntity)
    private readonly configRepo: Repository<SystemConfigEntity>,
  ) {}

  onModuleInit(): void {
    this.registry.onTaskSettled((taskId, failed) => this.onTaskSettled(taskId, failed))
    this.timer = setInterval(() => {
      this.tick().catch((error: unknown) => {
        console.error(`[清洗调度] 检查失败：${error instanceof Error ? error.message : String(error)}`)
      })
    }, TICK_INTERVAL_MS)
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  /**
   * 立即触发一次清洗。date 指定时只洗那天，否则洗全部欠账（≤昨天）。
   */
  async cleanNow(date?: string): Promise<ICleanNowRes> {
    await this.enqueueBacklog(date)
    const queuedBeforeDrain = this.queue.length
    this.drain()
    return { dispatched: queuedBeforeDrain - this.queue.length, pending: this.queue.length }
  }

  private async tick(): Promise<void> {
    const config = await this.loadConfig()
    const now = dayjs()
    const today = now.format('YYYY-MM-DD')
    if (config.enabled && now.format('HH:mm') >= config.dailyTime) {
      const lastRun = await this.redisService.get<string>(LAST_RUN_KEY)
      if (lastRun !== today) {
        await this.redisService.set(LAST_RUN_KEY, today, 86400 * 3)
        console.log('[清洗调度] 到点触发每日清洗')
        await this.enqueueBacklog()
      }
    }
    this.drain()
  }

  private async loadConfig(): Promise<{ enabled: boolean; dailyTime: string }> {
    const rows = await this.configRepo.find({
      where: [{ key: CONFIG_KEY_ENABLED }, { key: CONFIG_KEY_DAILY_TIME }],
    })
    const map = new Map(rows.map(row => [row.key, row.value]))
    const dailyTime = map.get(CONFIG_KEY_DAILY_TIME)
    return {
      enabled: map.get(CONFIG_KEY_ENABLED) === 'true',
      dailyTime: dailyTime && /^\d{2}:\d{2}$/.test(dailyTime) ? dailyTime : DEFAULT_DAILY_TIME,
    }
  }

  /**
   * 枚举欠账（已写入 event_log 但尚未进入 final_event_log 的 (date, session)），
   * 按 (date, session) 对去重，跨天 session 已洗的切片跳过、未洗的照捞。
   * @returns 新入队的任务数
   */
  private async enqueueBacklog(date?: string): Promise<number> {
    const runDate = dayjs().format('YYYY-MM-DD')
    const dateCondition = date
      ? `toDate(\`$service_time\`) = {targetDate:String}`
      : `toDate(\`$service_time\`) <= {yesterday:String}`
    const params = date
      ? { targetDate: date }
      : { yesterday: dayjs().subtract(1, 'day').format('YYYY-MM-DD') }
    const rows = await this.clickhouseService.query<BacklogRow>(`
      SELECT DISTINCT \`$session_id\` AS session_id, toDate(\`$service_time\`) AS date
      FROM event_log
      WHERE ${dateCondition}
        AND (toDate(\`$service_time\`), \`$session_id\`) NOT IN (
          SELECT toDate(\`$service_time\`), \`$session_id\` FROM final_event_log
          WHERE ${dateCondition}
        )
    `, params)
    const queuedIds = new Set(this.queue.map(task => task.task_id))
    const tasks = planCleaningTasks(rows, runDate).filter(task => !queuedIds.has(task.task_id))
    this.queue.push(...tasks)
    console.log(`[清洗调度] 枚举到 ${rows.length} 个欠账 session，新入队 ${tasks.length} 个任务`)
    return tasks.length
  }

  /** 把队列中的任务逐个下发给在线空闲节点，直到没有任务或没有空闲节点 */
  private drain(): void {
    if (this.draining) return
    this.draining = true
    try {
      while (this.queue.length > 0) {
        const nodeId = this.registry.pickIdleNode()
        if (!nodeId) return
        const task = this.queue.shift()!
        if (this.registry.dispatchTask(nodeId, task)) {
          console.log(`[清洗调度] 任务 ${task.task_id} 已下发到节点 ${nodeId}`)
        } else {
          this.queue.unshift(task)
          return
        }
      }
    } finally {
      this.draining = false
    }
  }

  /** 任务落定：失败则换 :r{n} 后缀重新入队（同日限重试 MAX_ATTEMPTS 次），然后立刻补发 */
  private onTaskSettled(taskId: string, failed: boolean): void {
    if (failed) {
      const attempt = (this.attempts.get(taskId) || 0) + 1
      this.attempts.set(taskId, attempt)
      if (attempt <= MAX_ATTEMPTS) {
        // 从 task_id 还原任务：clean:{runDate}:{taskDate}:{sessionId}[:r{n}]
        const base = taskId.replace(/:r\d+$/, '')
        const parts = base.split(':')
        const sessionId = parts.slice(3).join(':')
        const task: ComputeTask = {
          task_id: `${base}:r${attempt}`,
          session_id: sessionId,
          date: parts[2],
        }
        console.warn(`[清洗调度] 任务 ${taskId} 失败，第 ${attempt} 次重试`)
        this.queue.push(task)
      } else {
        console.error(`[清洗调度] 任务 ${taskId} 重试 ${MAX_ATTEMPTS} 次仍失败，放弃，次日自动补洗`)
      }
    }
    this.drain()
  }
}
```

注意点（实现时核对）：
- `session_id` 是 SDK 生成的 uuidv4，不含 `:`，`split(':')` 还原是安全的；`parts.slice(3).join(':')` 是防御性写法。
- `attempts` Map 只涨不清理，key 带 runDate，每天自然隔离，量级小无需清理。

- [ ] **Step 5: 注册到 compute-node 模块**

`compute-node.module.ts` 改为：

```ts
import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ClickHouseModule } from '@probe-x/shared-utils/src/lib/backend-common'
import { ComputeNodeEntity } from '@probe-x/shared-utils/src/lib/backend-common/entity/ComputeNode.entity'
import { UserRoleRelation } from '@probe-x/shared-utils/src/lib/backend-common/entity/UserRoleRelation.entity'
import { Role } from '@probe-x/shared-utils/src/lib/backend-common/entity/Role.entity'
import { SystemConfigEntity } from '@probe-x/shared-utils/src/lib/backend-common/entity/SystemConfig.entity'
import { ComputeNodeController } from './compute-node.controller'
import { ComputeNodeService } from './compute-node.service'
import { NodeControlController } from './node-control.controller'
import { NodeRegistryService } from './node-registry.service'
import { CleaningSchedulerService } from './cleaning-scheduler.service'
import { AdminGuard } from '../../guard/admin.guard'

@Module({
  imports: [
    TypeOrmModule.forFeature([ComputeNodeEntity, UserRoleRelation, Role, SystemConfigEntity]),
    ClickHouseModule,
  ],
  // NodeControlController 只有 gRPC handler，没有 HTTP 路由，不走 AdminGuard
  controllers: [ComputeNodeController, NodeControlController],
  providers: [ComputeNodeService, NodeRegistryService, CleaningSchedulerService, AdminGuard],
  exports: [ComputeNodeService, NodeRegistryService, CleaningSchedulerService],
})
export class ComputeNodeModule {}
```

- [ ] **Step 6: 跑测试确认通过**

Run: `node --test scripts/cleaning-scheduler.test.cjs`
Expected: PASS（2 个用例）

- [ ] **Step 7: 接 clean-now 端点**

`system-config.controller.ts`：

1. shared-types import 列表追加：`ICleanNowReq, ICleanNowRes`；追加 import：

```ts
import { CleaningSchedulerService } from '../compute-node/cleaning-scheduler.service'
```

2. 构造函数注入追加一个参数：

```ts
    private readonly cleaningSchedulerService: CleaningSchedulerService,
```

3. 类内追加端点：

```ts
  /**
   * 立即触发一次最终数据清洗
   */
  @Post('general/clean-now')
  async cleanNow(@Body() body: ICleanNowReq): Promise<ICleanNowRes> {
    return this.cleaningSchedulerService.cleanNow(body?.date)
  }
```

`system-config.module.ts`：imports 数组追加 `ComputeNodeModule`（顶部加 `import { ComputeNodeModule } from '../compute-node/compute-node.module'`）。ComputeNodeModule 不反向 import SystemConfigModule，无循环依赖。

- [ ] **Step 8: 构建 api 服务确认编译**

Run: `yarn workspace data-dashboard-api-service build`
Expected: 构建成功（仅既有的 2 条 RedisModuleOptions warning）

- [ ] **Step 9: Commit**

```bash
git add apps/data-dashboard-api-service/src/api/compute-node/ apps/data-dashboard-api-service/src/api/system-config/ scripts/cleaning-scheduler.test.cjs
git commit -m "feat: 总服务新增最终数据清洗调度器，支持每日定时触发与手动触发"
```

---

### Task 4: 前端「通用设置」页面

**Files:**
- Create: `apps/frontend/src/pages/system-config/general/index.tsx`
- Create: `apps/frontend/src/pages/system-config/general/services.ts`
- Create: `apps/frontend/src/pages/system-config/general/type.ts`
- Create: `apps/frontend/src/pages/system-config/general/model.ts`
- Modify: `apps/frontend/src/router/page/SystemConfig.tsx`（children 加一项）
- Modify: `apps/frontend/src/store/models/index.ts`（RootModel 接口 + models 对象各加一条）

**Interfaces:**
- Consumes: Task 2/3 的三个接口；`IGeneralConfig` / `ICleanNowRes`（`@probe-x/shared-types/src`）
- Produces: 路由 `/system-config/general`（菜单名「通用设置」）；model `systemConfigGeneralModel`

- [ ] **Step 1: type.ts**

创建 `apps/frontend/src/pages/system-config/general/type.ts`：

```ts
import { IGeneralConfig } from '@probe-x/shared-types/src'

export interface IGeneralConfigState {
  config: IGeneralConfig
}

export type { IGeneralConfig }
```

- [ ] **Step 2: services.ts**

创建 `apps/frontend/src/pages/system-config/general/services.ts`：

```ts
import request from "@/lib/request"
import { IGeneralConfig, ICleanNowReq, ICleanNowRes } from '@probe-x/shared-types/src'

export function getGeneralConfig() {
  return request<IGeneralConfig>({
    url: '/system-config/general',
    method: 'get',
  })
}

export function updateGeneralConfig(data: IGeneralConfig) {
  return request<IGeneralConfig>({
    url: '/system-config/general',
    method: 'put',
    data,
  })
}

export function cleanNow(data: ICleanNowReq) {
  return request<ICleanNowRes>({
    url: '/system-config/general/clean-now',
    method: 'post',
    data,
  })
}
```

（若 `@/lib/request` 不支持 `put` 方法，看 `apps/frontend/src/lib/request` 的封装改用 post；以封装实际能力为准。）

- [ ] **Step 3: model.ts**

创建 `apps/frontend/src/pages/system-config/general/model.ts`：

```ts
import { createModel } from "@rematch/core"
import { RootModel } from "@/store/models"
import { message } from "antd"
import { IGeneralConfigState } from "./type"
import { getGeneralConfig, updateGeneralConfig, cleanNow } from "./services"
import { IGeneralConfig } from '@probe-x/shared-types/src'

const initState: IGeneralConfigState = {
  config: {
    enabled: false,
    dailyTime: '02:00',
  },
}

const systemConfigGeneralModel = createModel<RootModel>()({
  name: 'systemConfigGeneralModel',
  state: initState,
  reducers: {
    updateItem(state, payload) {
      return { ...state, ...payload }
    },
  },
  effects: (dispatch) => ({
    async getConfig() {
      const { data } = await getGeneralConfig()
      dispatch.systemConfigGeneralModel.updateItem({ config: data.data })
    },
    async saveConfig(payload: IGeneralConfig) {
      const { data } = await updateGeneralConfig(payload)
      dispatch.systemConfigGeneralModel.updateItem({ config: data.data })
      message.success('保存成功')
    },
    async cleanNow(payload: { date?: string }) {
      const { data } = await cleanNow(payload)
      message.success(`已触发清洗：下发 ${data.data.dispatched} 个任务，排队 ${data.data.pending} 个`)
    },
  }),
})

export default systemConfigGeneralModel
```

- [ ] **Step 4: index.tsx 页面**

创建 `apps/frontend/src/pages/system-config/general/index.tsx`：

```tsx
import React, { useCallback, useEffect, useState } from "react"
import { Button, DatePicker, Form, Space, Switch, TimePicker } from "antd"
import dayjs from "dayjs"
import PageHeader from "@components/PageHeader"
import { useDispatch, useLoading, useModel } from "@/hooks"
import { Dispatch } from "@/store/storeContext"
import { IGeneralConfigState } from "./type"

function GeneralConfig() {
  const dispatch = useDispatch<Dispatch>()
  const loading = useLoading()
  const { config } = useModel<IGeneralConfigState>('systemConfigGeneralModel')
  const [form] = Form.useForm()
  const [cleanDate, setCleanDate] = useState<dayjs.Dayjs | null>(null)

  useEffect(() => {
    dispatch.systemConfigGeneralModel.getConfig()
  }, [dispatch])

  useEffect(() => {
    form.setFieldsValue({
      enabled: config.enabled,
      dailyTime: dayjs(config.dailyTime, 'HH:mm'),
    })
  }, [config, form])

  const handleSave = useCallback(async () => {
    const values = await form.validateFields()
    await dispatch.systemConfigGeneralModel.saveConfig({
      enabled: values.enabled,
      dailyTime: values.dailyTime.format('HH:mm'),
    })
  }, [dispatch, form])

  const handleCleanNow = useCallback(async () => {
    await dispatch.systemConfigGeneralModel.cleanNow({
      date: cleanDate ? cleanDate.format('YYYY-MM-DD') : undefined,
    })
  }, [dispatch, cleanDate])

  const saving = loading.systemConfigGeneralModel?.saveConfig
  const cleaning = loading.systemConfigGeneralModel?.cleanNow

  return (
    <div>
      <PageHeader title="通用设置" onRefresh={() => dispatch.systemConfigGeneralModel.getConfig()} loading={loading.systemConfigGeneralModel?.getConfig} />
      <p>
        全局运行参数。最终数据清洗每天在配置时间自动执行一次，清洗昨天及以前尚未清洗的数据；
        已清洗过的会话不会重复清洗。也可选择日期后立即手动触发，不选日期则补全部欠账。
      </p>
      <Form form={form} layout="vertical" style={{ maxWidth: 480 }}>
        <Form.Item name="enabled" label="每日定时清洗" valuePropName="checked">
          <Switch checkedChildren="开启" unCheckedChildren="关闭" />
        </Form.Item>
        <Form.Item name="dailyTime" label="每日清洗时间" rules={[{ required: true, message: "请选择每日清洗时间" }]}>
          <TimePicker format="HH:mm" minuteStep={5} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item>
          <Button type="primary" onClick={handleSave} loading={saving}>
            保存
          </Button>
        </Form.Item>
      </Form>
      <Space>
        <DatePicker value={cleanDate} onChange={setCleanDate} placeholder="选择清洗日期（可选）" allowClear />
        <Button onClick={handleCleanNow} loading={cleaning}>
          立即清洗
        </Button>
      </Space>
    </div>
  )
}

export default GeneralConfig
```

注意：Form 里不要有叫 `nodeName` 等 HTMLFormElement 内置属性同名的字段（本会话刚修过的坑）；本表单字段名 `enabled`/`dailyTime` 均安全。

- [ ] **Step 5: 注册路由和 model**

`apps/frontend/src/router/page/SystemConfig.tsx` children 数组中「系统参数配置」之前插入：

```ts
  , {
    name: '通用设置',
    key: 'system-config-general',
    path: '/system-config/general',
    component: lazy(() => import('@pages/system-config/general')),
  }
```

（注意保持数组语法正确：在前一个对象 `}, {` 的逗号结构里插入。）

`apps/frontend/src/store/models/index.ts`：
1. `RootModel` 接口中（对照 `systemConfigComputeNodeModel` 那条）加：
   ```ts
   systemConfigGeneralModel: typeof systemConfigGeneralModel
   ```
2. `models` 对象中加：
   ```ts
   systemConfigGeneralModel,
   ```
3. 顶部 import：
   ```ts
   import systemConfigGeneralModel from "@pages/system-config/general/model"
   ```

- [ ] **Step 6: 构建前端验证编译**

Run: `yarn workspace frontend build`
Expected: 构建成功。

- [ ] **Step 7: Commit**

```bash
git add apps/frontend/src/pages/system-config/general/ apps/frontend/src/router/page/SystemConfig.tsx apps/frontend/src/store/models/index.ts
git commit -m "feat: 系统设置新增通用设置页，支持配置每日清洗时间与手动触发清洗"
```

---

### Task 5: 端到端手动验证

**Files:** 无（验证步骤）

- [ ] **Step 1: 数据库建表**

开发库执行（生产靠 init-db.sql / create-missing-tables.sql）：

```bash
docker compose exec mysql mysql -uroot -p probe_x < scripts/create-missing-tables.sql
```

（MySQL 连接方式以本地 docker-compose.yml 为准；或等 api 服务以 DB_SYNCHRONIZE=true 启动自动建表。）

- [ ] **Step 2: 启动全链路**

```bash
yarn dev
```

确认 data-dashboard-api-service、final-data-cleaning-service（计算节点）、preliminary-data-processing-service 都在线。

- [ ] **Step 3: 验证设置读写**

浏览器打开 `/system-config/general`：开启定时清洗、选当前时间 2 分钟后的时间、保存、刷新页面确认回显正确。

- [ ] **Step 4: 验证手动触发**

点「立即清洗」（不选日期）→ 预期 message 提示下发/排队数；计算节点配置页观察节点变 busy；ClickHouse 查 `final_event_log` 出现新数据；节点日志有清洗进度。

- [ ] **Step 5: 验证幂等**

再点一次「立即清洗」→ 预期下发 0 个（欠账已清空，已洗 session 被跳过）；`final_event_log` 行数不变。

- [ ] **Step 6: 验证定时触发**

等 Step 3 配置的时间到点，观察 api 服务日志出现 `[清洗调度] 到点触发每日清洗`。

- [ ] **Step 7: Commit（如有验证中发现并修复的问题）**

```bash
git add -A
git commit -m "fix: 清洗调度端到端验证问题修复"
```

---

## Self-Review 记录

- Spec 覆盖：配置存储（Task 1）、读写接口（Task 2）、调度器 + 手动触发（Task 3）、前端页（Task 4）、验证（Task 5）——spec 各节均有对应任务。
- 类型一致性：`IGeneralConfig/ICleanNowReq/ICleanNowRes`（Task 1 定义）在 Task 2/3/4 使用一致；`pickIdleNode/onTaskSettled/cleanNow` 签名前后一致。
- 已知取舍：`clean-now` 路由最终落在 `/system-config/general/clean-now`（SystemConfigModule import ComputeNodeModule，无循环依赖），与 spec 一致。
