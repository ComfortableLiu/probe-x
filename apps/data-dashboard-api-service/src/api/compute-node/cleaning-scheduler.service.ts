import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import dayjs from 'dayjs'
import { BusinessException, ClickHouseService, RedisService, SystemConfigEntity } from '@probe-x/shared-utils/src/lib/backend-common'
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
 * (date, session) 去重键：同一数据切片严禁洗两遍（final_event_log 是 MergeTree 不去重），
 * 队列积压跨天（runDate 变了导致 task_id 不同）与任务在途两种场景都按它判重
 */
function backlogKey(task: ComputeTask): string {
  return `${task.date}|${task.session_id}`
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
  /** 已下发待落定的切片（`${date}|${session_id}`），防止在途任务被 cleanNow 重发给另一台节点 */
  private readonly inflight = new Set<string>()
  /** 任务 base id（不含 :r{n} 后缀）-> 已尝试次数，失败重试用 :r{n} 后缀 */
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
    if (date) {
      // 格式校验前置：垃圾字符串一路到 ClickHouse 会变成 500
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        throw new BusinessException(`清洗日期格式非法：${date}，应为 YYYY-MM-DD`)
      }
      // 今天及未来的切片仍在进行中：洗一半落库后，当天后续到达的事件永远不会被最终清洗
      // （final_event_log 是 MergeTree 不去重，已洗切片按设计不能重洗），只能洗今天以前的数据
      if (date >= dayjs().format('YYYY-MM-DD')) {
        throw new BusinessException('只能清洗今天以前的数据，今天及未来的切片仍在进行中')
      }
    }
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
        console.log('[清洗调度] 到点触发每日清洗')
        await this.enqueueBacklog()
        // 枚举成功后才记当天额度：先写 key 时枚举一旦抛错，当天会被静默跳过；
        // 崩溃后重枚举是安全的（同 task_id 命中节点侧幂等键）
        await this.redisService.set(LAST_RUN_KEY, today, 86400 * 3)
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
    const queuedKeys = new Set(this.queue.map(task => backlogKey(task)))
    const tasks = planCleaningTasks(rows, runDate)
      .filter(task => !queuedKeys.has(backlogKey(task)) && !this.inflight.has(backlogKey(task)))
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
          this.inflight.add(backlogKey(task))
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
    // 只处理本调度器发出的清洗任务，未来其他任务类型落定不得被误解析成垃圾任务重入队
    if (!taskId.startsWith('clean:')) return
    // 从 task_id 还原任务：clean:{runDate}:{taskDate}:{sessionId}[:r{n}]
    // 计数键必须是剥离后缀的 base，否则 A:r1 失败会重新算成第 1 次、:r{n} 永不递增
    const base = taskId.replace(/:r\d+$/, '')
    const parts = base.split(':')
    const sessionId = parts.slice(3).join(':')
    this.inflight.delete(`${parts[2]}|${sessionId}`)
    if (failed) {
      const attempt = (this.attempts.get(base) || 0) + 1
      this.attempts.set(base, attempt)
      if (attempt <= MAX_ATTEMPTS) {
        const task: ComputeTask = {
          task_id: `${base}:r${attempt}`,
          session_id: sessionId,
          date: parts[2],
        }
        console.warn(`[清洗调度] 任务 ${taskId} 失败，第 ${attempt} 次重试`)
        this.queue.push(task)
      } else {
        console.error(`[清洗调度] 任务 ${base} 重试 ${MAX_ATTEMPTS} 次仍失败，放弃，次日自动补洗`)
      }
    }
    this.drain()
  }
}
