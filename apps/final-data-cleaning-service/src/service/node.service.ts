import { recordCleaningOutcome, recordRuntimeMetric } from '@probe-x/shared-utils/src/lib/backend-common/runtime-metrics'
import { Injectable, Logger, Optional } from '@nestjs/common'
import { availableParallelism, hostname } from 'os'
import { Subject } from 'rxjs'
import { ClickHouseService, RedisService } from "@probe-x/shared-utils/src/lib/backend-common"
import { IPreEventLog } from "@probe-x/shared-types/src"
import { computeAttribution } from "../lib/attribution-engine"
import { AttributionWorkerPool } from "../lib/attribution-worker-pool"
import { collectNodeInfo } from "../lib/node-info"
import type { ComputeTask, ProgressUpdate } from "../type"

// 任务流与进度流的类型定义由 ../type 统一维护，这里转出以兼容既有引用
export type { ComputeTask, ProgressUpdate } from "../type"

// 把主机名规整为可用的节点 id 片段（小写、仅保留字母数字和连字符）
function normalizeHostname(): string {
  const normalized = hostname().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '')
  return normalized || 'unknown'
}

interface ActiveTask {
  task: ComputeTask
  sliceKey: string
  subjects: Set<Subject<ProgressUpdate>>
  completion: Promise<void>
  resolve: () => void
  lastProgress?: ProgressUpdate
}

@Injectable()
export class ComputeNodeService {
  /** 节点唯一标识 */
  nodeId: string
  /** 节点展示名 */
  nodeName: string
  private readonly logger = new Logger(ComputeNodeService.name)
  private lastMetricsWarning = 0
  private readonly activeTasks = new Map<string, ActiveTask>()
  private readonly queuedTasks: ActiveTask[] = []
  private readonly runningSlices = new Set<string>()
  private runningTaskCount = 0
  /** 整个任务的查询、计算和落库共用同一个容量限制。 */
  readonly taskCapacity: number
  /** 最近一次任务失败信息，空串表示无异常 */
  lastError = ''

  constructor(
    private readonly clickhouseService: ClickHouseService,
    // 可选注入：单测直接 new 出来的实例没有 RedisService，任务去重逻辑自动跳过
    @Optional() private readonly redisService?: RedisService,
    // 生产环境由 AppModule 提供线程池；保留直接 new 实例的纯函数测试方式
    @Optional() private readonly attributionWorkerPool?: AttributionWorkerPool,
  ) {
    // NODE_ID 未设置时按主机名生成稳定 id：同一机器/容器重启后 id 不变，
    // 拓扑图上不会每次重启都多出一个离线节点；docker/k8s 多副本主机名天然不同，无需额外配置；
    // 同一台机器起多个进程做压测时，需显式设置不同的 NODE_ID 区分
    this.nodeId = process.env.NODE_ID || `node-${normalizeHostname()}`
    this.nodeName = process.env.NODE_NAME || this.nodeId
    this.taskCapacity = Math.max(1, Math.floor(this.attributionWorkerPool?.concurrency || availableParallelism()))
  }

  /** 所有已接收且尚未结束的任务，包含等待同一 session 或等待容量的任务。 */
  get currentTaskIds(): string[] {
    return [...this.activeTasks.keys()]
  }

  get currentTaskId(): string {
    return this.currentTaskIds[0] || ''
  }

  get activeTaskCount(): number {
    return this.activeTasks.size
  }

  /** 采集节点资源与运行状态，用于注册帧/心跳帧 */
  getLocalNodeInfo() {
    this.recordMetric(() => recordRuntimeMetric(this.redisService.getClient(), 'processing', 0))
    return collectNodeInfo(this.currentTaskIds, this.taskCapacity)
  }

  private recordMetric(write: () => Promise<void>): void {
    if (!this.redisService) return
    // Telemetry failure must never turn a successful cleaning task into a failed one.
    Promise.resolve().then(write).catch(() => {
      if (Date.now() - this.lastMetricsWarning > 60000) {
        this.lastMetricsWarning = Date.now()
        this.logger.warn('处理量采样未能写入 Redis，此期间采样可能不完整')
      }
    })
  }

  // 把所有事件查出来
  async getAllEvents(date: string, sessionId: string) {
    const sql = `
        SELECT *
        FROM event_log
        WHERE toDate(\`$service_time\`) = {queryDate: DateTime64}
          AND \`$session_id\` = {sessionId: String}
        ORDER BY \`$service_time\`;
    `

    return this.clickhouseService.query<IPreEventLog>(sql, {
      queryDate: date,
      sessionId: sessionId,
    })
  }

  // 接收即登记，重连时可恢复所有任务；超容量任务在读取事件之前等待。
  executeTask(task: ComputeTask, progressSubject: Subject<ProgressUpdate>): Promise<void> {
    const existing = this.activeTasks.get(task.task_id)
    if (existing) {
      // 同一任务重放时共享真实执行及其终态，不能把仍在执行的 Redis NX 键误当成成功。
      existing.subjects.add(progressSubject)
      if (existing.lastProgress && !progressSubject.closed) progressSubject.next(existing.lastProgress)
      return existing.completion
    }

    let resolve: () => void
    const completion = new Promise<void>(complete => { resolve = complete })
    const activeTask: ActiveTask = {
      task,
      sliceKey: JSON.stringify([task.date, task.session_id]),
      subjects: new Set([progressSubject]),
      completion,
      resolve: resolve!,
    }
    this.activeTasks.set(task.task_id, activeTask)
    this.queuedTasks.push(activeTask)
    this.startQueuedTasks()
    return completion
  }

  private startQueuedTasks(): void {
    while (this.runningTaskCount < this.taskCapacity) {
      // 同一 (date, session) 不得并行查重/写入；其他 session 仍可使用空闲容量。
      const index = this.queuedTasks.findIndex(active => !this.runningSlices.has(active.sliceKey))
      if (index < 0) return
      const [active] = this.queuedTasks.splice(index, 1)
      this.runningTaskCount += 1
      this.runningSlices.add(active.sliceKey)
      void this.runTask(active).then(
        terminal => this.finishTask(active, terminal),
        error => this.finishTask(active, {
          task_id: active.task.task_id,
          node_id: this.nodeId,
          target: 0,
          progress: 0,
          message: '',
          completed: false,
          error: error instanceof Error ? error.message : String(error),
          failed: true,
        }),
      ).catch(error => {
        // 进度消费者异常也不能留下未处理的 rejection 或占住任务容量。
        this.lastError = error instanceof Error ? error.message : String(error)
      })
    }
  }

  private finishTask(active: ActiveTask, terminal: ProgressUpdate): void {
    // 先释放自己的状态，再发送终态；终态回调可能同步下发新的任务。
    this.activeTasks.delete(active.task.task_id)
    this.runningTaskCount -= 1
    this.runningSlices.delete(active.sliceKey)
    try {
      this.startQueuedTasks()
      this.sendProgress(active, terminal)
    } finally {
      active.resolve()
    }
  }

  private sendProgress(active: ActiveTask, progress: ProgressUpdate): void {
    active.lastProgress = progress
    active.subjects.forEach(subject => {
      // Subject.unsubscribe() 后 next 会抛错；断开的消费者不影响任务及其他进度流。
      if (!subject.closed) subject.next(progress)
    })
  }

  private async runTask(active: ActiveTask): Promise<ProgressUpdate> {
    const { task } = active
    const progressSubject = { next: (progress: ProgressUpdate) => this.sendProgress(active, progress) }
    const startTime = Date.now()
    try {
      this.logger.log(`[清洗] 任务 ${task.task_id} 开始执行（session: ${task.session_id}，日期: ${task.date}）`)
      // 任务级幂等：总服务重复下发同一 task_id 时只执行一次，
      // SET NX EX 86400 已存在则视为已成功重放，跳过执行并直接推 completed:true 进度
      if (this.redisService) {
        const isNewTask = await this.redisService.setNx(`clean:task:${task.task_id}`, '1', 86400)
        if (!isNewTask) {
          this.logger.log(`[清洗] 任务 ${task.task_id} 已处理过（重复下发），直接标记完成`)
          return {
            task_id: task.task_id,
            node_id: this.nodeId,
            target: 0,
            progress: 0,
            message: '任务已处理过（重复下发），直接标记完成',
            completed: true,
            error: '',
            failed: false,
          }
        }
      }

      // 拿到所有事件
      const eventList = await this.getAllEvents(task.date, task.session_id)
      this.logger.log(`[清洗] 任务 ${task.task_id} 拉取到 ${eventList.length} 条事件，开始归因计算`)

      // 任务开始即推送初始进度，保证总服务能感知任务已被接收
      progressSubject.next({
        task_id: task.task_id,
        node_id: this.nodeId,
        target: eventList.length,
        progress: 0,
        message: '任务已接收，开始归因计算',
        completed: false,
        error: '',
        failed: false,
      })

      // 每个任务使用一个 worker，多个 session 由线程池并行计算；进度按任务独立限频。
      let lastProgressAt = Date.now()
      const reportProgress = (processed: number, total: number) => {
        const now = Date.now()
        if (processed < total && now - lastProgressAt < 100) return
        lastProgressAt = now
        progressSubject.next({
          task_id: task.task_id,
          node_id: this.nodeId,
          target: total,
          progress: processed,
          message: `正在处理第 ${processed}/${total} 个事件`,
          completed: false,
          error: '',
          failed: false,
        })
      }
      const result = this.attributionWorkerPool
        ? await this.attributionWorkerPool.compute(eventList, reportProgress)
        : computeAttribution(eventList, reportProgress)

      this.logger.log(`[清洗] 任务 ${task.task_id} 归因完成：${result.finalEvents.length} 条清洗事件、${result.attributions.length} 条归因记录，开始落库`)

      // 事件级幂等：双表并行落库不具备原子性，一成一败后调度器会以新 task_id（:rN）重试，
      // 任务级幂等键拦截不到；MergeTree 表无唯一约束，故插入前按 (date, session_id) 查出两张表
      // 已落库的事件 id，过滤掉已存在的记录再插入，保证重试不会产生重复数据
      const existingQueryParams = { queryDate: task.date, sessionId: task.session_id }
      const [existingEventRows, existingAttributionRows] = await Promise.all([
        this.clickhouseService.query<{ $event_id: string }>(
          `
        SELECT \`$event_id\`
        FROM final_event_log
        WHERE toDate(\`$service_time\`) = {queryDate: DateTime64}
          AND \`$session_id\` = {sessionId: String};
          `,
          existingQueryParams,
        ),
        this.clickhouseService.query<{ event_id: string }>(
          `
        SELECT DISTINCT event_id
        FROM event_attribution
        WHERE toDate(event_time) = {queryDate: DateTime64}
          AND session_id = {sessionId: String};
          `,
          existingQueryParams,
        ),
      ])
      const existingEventIds = new Set(existingEventRows.map(row => row.$event_id))
      const existingAttributionEventIds = new Set(existingAttributionRows.map(row => row.event_id))
      const finalEvents = result.finalEvents.filter(event => !existingEventIds.has(event.$event_id))
      const attributions = result.attributions.filter(attr => !existingAttributionEventIds.has(attr.event_id))

      const writes: Promise<unknown>[] = []
      if (finalEvents.length > 0) {
        writes.push(this.clickhouseService.insert('final_event_log', finalEvents).then(() => {
          this.recordMetric(() => recordRuntimeMetric(this.redisService.getClient(), 'processing', finalEvents.length))
        }))
      }
      if (attributions.length > 0) {
        writes.push(this.clickhouseService.insert('event_attribution', attributions))
      }
      // 一张表失败时也等待另一张表结束，避免重试与仍在进行的旧写入重叠
      const writeResults = await Promise.allSettled(writes)
      const failedWrite = writeResults.find((result): result is PromiseRejectedResult => result.status === 'rejected')
      if (failedWrite) throw failedWrite.reason

      this.recordMetric(() => recordCleaningOutcome(this.redisService.getClient(), true))

      this.logger.log(`[清洗] 任务 ${task.task_id} 完成，落库 ${finalEvents.length} 条清洗事件，耗时 ${Date.now() - startTime}ms`)

      // TODO 手动回滚逻辑

      this.lastError = ''

      // 任务结束只发送一条 completed:true 的进度，不要 complete() 共享流，
      // 共享 Subject 的生命周期与整个连接一致，complete 后后续任务将无法再推送进度
      return {
        task_id: task.task_id,
        node_id: this.nodeId,
        target: eventList.length,
        progress: eventList.length,
        message: '任务完成',
        completed: true,
        error: '',
        failed: false,
      }
    } catch (e) {
      this.recordMetric(() => recordCleaningOutcome(this.redisService.getClient(), false))
      const error = e instanceof Error ? e.message : String(e)
      this.lastError = error
      this.logger.error(`[清洗] 任务 ${task.task_id} 执行失败：${error}`)
      // 任务失败时通过进度流推送失败状态，避免静默失败
      return {
        task_id: task.task_id,
        node_id: this.nodeId,
        target: 0,
        progress: 0,
        message: '',
        completed: false,
        error,
        failed: true,
      }
    }
  }
}
