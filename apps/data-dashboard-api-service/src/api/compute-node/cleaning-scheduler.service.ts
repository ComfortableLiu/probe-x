import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import dayjs from 'dayjs'
import { BusinessException, ClickHouseService, RedisService, SystemConfigEntity } from '@probe-x/shared-utils/src/lib/backend-common'
import { ComputeTask, ICleanNowRes } from '@probe-x/shared-types/src'
import { NodeRegistryService } from './node-registry.service'
import { readCleaningBacklogPage, readRustIncompleteSlices } from './cleaning-backlog-reader'
import type { BacklogCursor, BacklogPage, BacklogRange, BacklogRow } from './cleaning-backlog-reader'

/** 调度检查间隔 */
const TICK_INTERVAL_MS = 60000
/** 记录今天是否已定时触发过（防重启重复触发） */
const LAST_RUN_KEY = 'clean:scheduler:last_run_date'
/** 同一任务同日最多重试次数 */
const MAX_ATTEMPTS = 2
/** 同步回调也不能让大批任务长期占住事件循环。 */
const MAX_DISPATCHES_PER_TURN = 100
const MAX_SCAN_RANGES = 64
const RECENT_SLICE_LIMIT = 10000

function positiveSetting(name: string, fallback: number, maximum: number): number {
  const value = Number(process.env[name])
  return Number.isSafeInteger(value) && value > 0 ? Math.min(value, maximum) : fallback
}

const CONFIG_KEY_ENABLED = 'final_cleaning.enabled'
const CONFIG_KEY_DAILY_TIME = 'final_cleaning.daily_time'
const DEFAULT_DAILY_TIME = '02:00'

interface BacklogScan {
  range: BacklogRange
  cursor: BacklogCursor | null
  failed: boolean
  nextRange?: BacklogRange
  waitingForTasks?: boolean
}

interface BufferedPage {
  scan: BacklogScan
  page: BacklogPage
  index: number
  throughDate: string
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
    tasks.push({ task_id: taskId, session_id: row.session_id, date: row.date,
      ...(row.required_runtime ? { required_runtime: row.required_runtime } : {}) })
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
  private readonly detailLogsEnabled = process.env.CLEANING_DETAIL_LOG_ENABLED === 'true'
  /** 按切片去重的有序队列，删除队首不搬移剩余任务。 */
  private readonly queue = new Map<string, ComputeTask>()
  /** 跨轮保留游标，避免每次出队都重新扫描 Map 开头的已删除项。 */
  private queueIterator = this.queue.entries()
  /** 已下发待落定的切片（`${date}|${session_id}`），防止在途任务被 cleanNow 重发给另一台节点 */
  private readonly inflight = new Set<string>()
  /** 精确记录下发 id，忽略重复或不属于本调度器的落定通知。 */
  private readonly dispatchedTasks = new Map<string, ComputeTask>()
  private readonly retryBases = new Map<string, string>()
  /** 任务 base id（不含 :r{n} 后缀）-> 已尝试次数，失败重试用 :r{n} 后缀 */
  private readonly attempts = new Map<string, number>()
  private draining = false
  private drainContinuation: ReturnType<typeof setImmediate> | null = null
  private stopped = false
  private dispatchedTaskCount = 0
  private readonly scanPageSize = positiveSetting('CLEANING_SCAN_PAGE_SIZE', 1000, 10000)
  private readonly maxBufferedTasks = positiveSetting('CLEANING_MAX_BUFFERED_TASKS', 2000, 100000)
  private readonly scans = new Map<string, BacklogScan>()
  private scanInFlight: { scan: BacklogScan; controller: AbortController } | null = null
  private scanContinuation: ReturnType<typeof setImmediate> | null = null
  private bufferedPage: BufferedPage | null = null
  /** 只记最近完成/放弃的切片，历史任务总量不应留在常驻内存里。 */
  private readonly recentSlices = new Map<string, string>()
  /** 跟踪已加载任务所属运行日，较新运行不能越过旧运行尚未落定的失败任务。 */
  private readonly loadedRuns = new Map<string, number>()
  private automaticRunDate: string | null = null
  private savingDailyRun = false

  constructor(
    private readonly registry: NodeRegistryService,
    private readonly clickhouseService: ClickHouseService,
    private readonly redisService: RedisService,
    @InjectRepository(SystemConfigEntity)
    private readonly configRepo: Repository<SystemConfigEntity>,
  ) {}

  onModuleInit(): void {
    this.stopped = false
    this.registry.onTaskSettled((taskId, failed) => this.onTaskSettled(taskId, failed))
    this.registry.onCapacityAvailable(() => this.drain())
    this.timer = setInterval(() => {
      this.tick().catch((error: unknown) => {
        console.error(`[清洗调度] 检查失败：${error instanceof Error ? error.message : String(error)}`)
      })
    }, TICK_INTERVAL_MS)
  }

  onModuleDestroy(): void {
    this.stopped = true
    this.scanInFlight?.controller.abort()
    if (this.scanContinuation) {
      clearImmediate(this.scanContinuation)
      this.scanContinuation = null
    }
    this.scans.clear()
    this.bufferedPage = null
    if (this.drainContinuation) {
      clearImmediate(this.drainContinuation)
      this.drainContinuation = null
    }
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
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !dayjs(date).isValid() || dayjs(date).format('YYYY-MM-DD') !== date) {
        throw new BusinessException(`清洗日期格式非法：${date}，应为 YYYY-MM-DD`)
      }
      // 今天及未来的切片仍在进行中：洗一半落库后，当天后续到达的事件永远不会被最终清洗
      // （final_event_log 是 MergeTree 不去重，已洗切片按设计不能重洗），只能洗今天以前的数据
      if (date >= dayjs().format('YYYY-MM-DD')) {
        throw new BusinessException('只能清洗今天以前的数据，今天及未来的切片仍在进行中')
      }
    }
    const dispatchedBefore = this.dispatchedTaskCount
    this.enqueueBacklog(date)
    this.drain()
    // 返回的是已接收范围与当前缓冲快照，不能等待全部历史数据枚举完才响应。
    const loading = this.scans.size > 0
    return {
      dispatched: this.dispatchedTaskCount - dispatchedBefore,
      pending: this.queue.size,
      loading,
      waitingForCapacity: loading && !this.registry.pickIdleNode(),
    }
  }

  private async tick(): Promise<void> {
    this.resumeScans()
    const config = await this.loadConfig()
    const now = dayjs()
    const today = now.format('YYYY-MM-DD')
    if (config.enabled && now.format('HH:mm') >= config.dailyTime) {
      const lastRun = await this.redisService.get<string>(LAST_RUN_KEY)
      if (lastRun !== today && this.automaticRunDate !== today) {
        console.log('[清洗调度] 到点触发每日清洗')
        this.enqueueBacklog()
        this.automaticRunDate = today
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
   * 注册扫描范围；只保留游标，实际查询由空闲容量驱动。
   * 重复点击复用现有范围，全历史扫描也覆盖它已有上界内的指定日期请求。
   */
  private enqueueBacklog(date?: string): void {
    if (this.stopped) throw new BusinessException('清洗调度器已停止')
    const runDate = dayjs().format('YYYY-MM-DD')
    const throughDate = date || dayjs().subtract(1, 'day').format('YYYY-MM-DD')
    const fullScan = this.scans.get('*')
    const key = date && !(fullScan && fullScan.range.throughDate >= date) ? date : '*'
    const existing = this.scans.get(key)
    if (existing) {
      if (existing.range.runDate !== runDate) {
        // 跨日触发必须安排从头补扫的一轮，旧游标之前的失败切片也需再次获得机会。
        existing.nextRange = {
          runDate,
          throughDate: existing.range.targetDate || dayjs().subtract(1, 'day').format('YYYY-MM-DD'),
          targetDate: existing.range.targetDate,
        }
      } else if (!date && existing.range.throughDate < throughDate) {
        existing.range.throughDate = throughDate
      }
      existing.failed = false
    } else {
      if (this.scans.size >= MAX_SCAN_RANGES) throw new BusinessException('清洗日期范围过多，请等待当前扫描完成')
      this.scans.set(key, { range: { runDate, throughDate, targetDate: date }, cursor: null, failed: false })
    }
    this.requestScan()
  }

  /** 查询失败保留同一页游标，由下一次巡检或手动触发恢复，避免快速重试压垮数据库。 */
  private resumeScans(): void {
    for (const scan of this.scans.values()) scan.failed = false
    this.requestScan()
  }

  private requestScan(): void {
    if (this.stopped || this.scanInFlight || this.scanContinuation) return
    if (this.loadedTaskCount === 0) {
      for (const scan of this.scans.values()) {
        if (!scan.waitingForTasks || !scan.nextRange) continue
        scan.range = scan.nextRange
        scan.nextRange = undefined
        scan.cursor = null
        scan.waitingForTasks = false
      }
    }
    if (!this.bufferedPage && !this.nextReadyScan()) {
      this.finishDailyRun()
      return
    }
    if (this.loadedTaskCount >= this.maxBufferedTasks || !this.registry.pickIdleNode()) return
    this.scanContinuation = setImmediate(() => {
      this.scanContinuation = null
      void this.loadNextPage()
    })
  }

  private async loadNextPage(): Promise<void> {
    if (this.stopped || this.scanInFlight) return
    if (!this.registry.pickIdleNode() || this.loadedTaskCount >= this.maxBufferedTasks) return
    if (!this.bufferedPage) {
      const scan = this.nextReadyScan()
      if (!scan) return
      const controller = new AbortController()
      const request = { scan, controller }
      this.scanInFlight = request
      const range = { ...scan.range }
      try {
        const limit = Math.min(this.scanPageSize, this.maxBufferedTasks - this.loadedTaskCount)
        const readIncomplete = typeof this.redisService.getClient === 'function'
          ? (candidates: BacklogRow[]) => readRustIncompleteSlices(this.redisService.getClient(), candidates)
          : undefined
        const page = await readCleaningBacklogPage(this.clickhouseService, range, scan.cursor, limit, controller.signal, readIncomplete)
        if (this.stopped || controller.signal.aborted || this.scanInFlight !== request) return
        this.bufferedPage = { scan, page, index: 0, throughDate: range.throughDate }
      } catch (error: unknown) {
        if (!this.stopped && !controller.signal.aborted) {
          scan.failed = true
          console.error(`[清洗调度] 分片加载失败，保留游标等待重试：${error instanceof Error ? error.message : String(error)}`)
        }
      } finally {
        if (this.scanInFlight === request) this.scanInFlight = null
      }
    }
    if (this.stopped) return
    const buffered = this.bufferedPage
    if (buffered) {
      while (buffered.index < buffered.page.rows.length && this.loadedTaskCount < this.maxBufferedTasks) {
        const row = buffered.page.rows[buffered.index++]
        this.enqueueTask({ task_id: buildTaskId(buffered.scan.range.runDate, row.date, row.session_id), session_id: row.session_id, date: row.date,
          ...(row.required_runtime ? { required_runtime: row.required_runtime } : {}) })
      }
      if (buffered.index === buffered.page.rows.length) {
        if (buffered.page.nextCursor) buffered.scan.cursor = buffered.page.nextCursor
        const entry = [...this.scans.entries()].find(([, scan]) => scan === buffered.scan)
        if (entry) {
          const [key, scan] = entry
          this.scans.delete(key)
          // 加载期间全历史范围可能扩展到新一天，旧范围末页不能提前结束新范围。
          if (!buffered.page.done || scan.range.throughDate !== buffered.throughDate) {
            this.scans.set(key, scan)
          } else if (scan.nextRange) {
            // 旧轮任务落定前不开始新轮，避免旧轮失败发生在新游标已经越过它之后。
            scan.waitingForTasks = true
            this.scans.set(key, scan)
          }
        }
        this.bufferedPage = null
      }
    }
    this.drain()
  }

  private get loadedTaskCount(): number {
    // 为在途失败重入队预留位置，任务数上限不因重试而被突破。
    return this.queue.size + this.inflight.size
  }

  private nextReadyScan(): BacklogScan | undefined {
    let oldestRunDate = ''
    for (const scan of this.scans.values()) {
      if (!oldestRunDate || scan.range.runDate < oldestRunDate) oldestRunDate = scan.range.runDate
    }
    for (const runDate of this.loadedRuns.keys()) {
      if (!oldestRunDate || runDate < oldestRunDate) oldestRunDate = runDate
    }
    return [...this.scans.values()].find(scan => scan.range.runDate === oldestRunDate && !scan.failed && !scan.waitingForTasks)
  }

  private trackLoadedRun(task: ComputeTask, delta: number): void {
    const runDate = task.task_id.split(':')[1]
    const count = (this.loadedRuns.get(runDate) || 0) + delta
    if (count > 0) this.loadedRuns.set(runDate, count)
    else this.loadedRuns.delete(runDate)
  }

  /** 仅在扫描及所有已加载任务均结束后记录额度，重启仍可重扫未完成日期。 */
  private finishDailyRun(): void {
    if (this.stopped || this.savingDailyRun || !this.automaticRunDate || this.scans.size || this.queue.size || this.inflight.size) return
    const runDate = this.automaticRunDate
    this.savingDailyRun = true
    void this.redisService.set(LAST_RUN_KEY, runDate, 86400 * 3).then(() => {
      if (this.automaticRunDate === runDate) this.automaticRunDate = null
    }).catch((error: unknown) => {
      console.error(`[清洗调度] 保存每日清洗状态失败：${error instanceof Error ? error.message : String(error)}`)
    }).finally(() => { this.savingDailyRun = false })
  }

  private enqueueTask(task: ComputeTask): boolean {
    const key = backlogKey(task)
    if (this.queue.has(key) || this.inflight.has(key) || this.recentSlices.get(key) === task.task_id.split(':')[1]
      || this.registry.hasActiveSlice(task.date, task.session_id)) return false
    this.queue.set(key, task)
    this.trackLoadedRun(task, 1)
    return true
  }

  private nextPendingTask(): ComputeTask | null {
    const scanLimit = this.queue.size
    for (let checked = 0; checked < scanLimit; checked += 1) {
      let entry = this.queueIterator.next()
      if (entry.done) {
        this.queueIterator = this.queue.entries()
        entry = this.queueIterator.next()
      }
      if (entry.done) return null
      const [key, task] = entry.value
      // 重连恢复的旧任务仍可能占用该切片，先处理其他未占用的切片。
      if (this.registry.hasActiveSlice(task.date, task.session_id)) continue
      if (task.required_runtime && !this.registry.pickIdleNode(task.required_runtime)) continue
      this.queue.delete(key)
      if (this.queue.size === 0) this.queueIterator = this.queue.entries()
      return task
    }
    return null
  }

  /** 按节点上报的容量填满任务槽，每个切片仍只允许一份任务在途。 */
  private drain(): void {
    if (this.draining || this.stopped) return
    if (this.drainContinuation) {
      clearImmediate(this.drainContinuation)
      this.drainContinuation = null
    }
    this.draining = true
    try {
      let dispatched = 0
      while (this.queue.size > 0 && dispatched < MAX_DISPATCHES_PER_TURN) {
        // 无容量时直接返回，避免白白扫描大队列。
        if (!this.registry.pickIdleNode()) return
        const task = this.nextPendingTask()
        if (!task) return
        const nodeId = this.registry.pickIdleNode(task.required_runtime)
        if (!nodeId) {
          this.queue.set(backlogKey(task), task)
          return
        }
        // 一旦开始由 Rust 处理，任何后续重试都必须保留其分批 KV 补齐语义。
        if (this.registry.isRustNode?.(nodeId)) task.required_runtime = 'rust'
        // 与节点槽位一样先预占，兼容 send 同步触发完成回调的通道实现。
        this.inflight.add(backlogKey(task))
        this.dispatchedTasks.set(task.task_id, task)
        let accepted = false
        try {
          accepted = this.registry.dispatchTask(nodeId, task)
        } catch (error: unknown) {
          console.error(`[清洗调度] 下发失败：${error instanceof Error ? error.message : String(error)}`)
        }
        if (accepted) {
          dispatched += 1
          this.dispatchedTaskCount += 1
          if (this.detailLogsEnabled) {
            console.log(`[清洗调度] 任务 ${task.task_id} 已下发到节点 ${nodeId}`)
          }
        } else {
          this.inflight.delete(backlogKey(task))
          this.dispatchedTasks.delete(task.task_id)
          this.queue.set(backlogKey(task), task)
          return
        }
      }
      if (this.queue.size > 0) {
        this.drainContinuation = setImmediate(() => {
          this.drainContinuation = null
          this.drain()
        })
      }
    } finally {
      this.draining = false
      this.requestScan()
    }
  }

  /** 任务落定：失败则换 :r{n} 后缀重新入队（同日限重试 MAX_ATTEMPTS 次），然后立刻补发 */
  private onTaskSettled(taskId: string, failed: boolean): void {
    const dispatched = this.dispatchedTasks.get(taskId)
    if (!dispatched) return
    this.dispatchedTasks.delete(taskId)
    this.trackLoadedRun(dispatched, -1)
    const base = this.retryBases.get(taskId) || taskId
    this.retryBases.delete(taskId)
    this.inflight.delete(backlogKey(dispatched))
    if (failed) {
      const attempt = (this.attempts.get(base) || 0) + 1
      this.attempts.set(base, attempt)
      if (attempt <= MAX_ATTEMPTS) {
        const task: ComputeTask = {
          task_id: `${base}:r${attempt}`,
          session_id: dispatched.session_id,
          date: dispatched.date,
          ...(dispatched.required_runtime ? { required_runtime: dispatched.required_runtime } : {}),
        }
        console.warn(`[清洗调度] 任务 ${taskId} 失败，第 ${attempt} 次重试`)
        this.retryBases.set(task.task_id, base)
        this.enqueueTask(task)
      } else {
        this.attempts.delete(base)
        this.rememberSlice(dispatched)
        console.error(`[清洗调度] 任务 ${base} 重试 ${MAX_ATTEMPTS} 次仍失败，放弃，次日自动补洗`)
      }
    } else {
      this.attempts.delete(base)
      this.rememberSlice(dispatched)
    }
    this.drain()
  }

  private rememberSlice(task: ComputeTask): void {
    const key = backlogKey(task)
    this.recentSlices.delete(key)
    this.recentSlices.set(key, task.task_id.split(':')[1])
    if (this.recentSlices.size > RECENT_SLICE_LIMIT) this.recentSlices.delete(this.recentSlices.keys().next().value!)
  }
}
