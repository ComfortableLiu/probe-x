import { recordCleaningOutcome, recordRuntimeMetric } from '@probe-x/shared-utils/src/lib/backend-common/runtime-metrics'
import { Injectable, Logger, Optional } from '@nestjs/common'
import { hostname } from 'os'
import { Subject } from 'rxjs'
import { ClickHouseService, RedisService } from "@probe-x/shared-utils/src/lib/backend-common"
import { IPreEventLog } from "@probe-x/shared-types/src"
import { computeAttribution } from "../lib/attribution-engine"
import { collectNodeInfo } from "../lib/node-info"
import type { ComputeTask, ProgressUpdate } from "../type"

// 任务流与进度流的类型定义由 ../type 统一维护，这里转出以兼容既有引用
export type { ComputeTask, ProgressUpdate } from "../type"

// 把主机名规整为可用的节点 id 片段（小写、仅保留字母数字和连字符）
function normalizeHostname(): string {
  const normalized = hostname().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '')
  return normalized || 'unknown'
}

@Injectable()
export class ComputeNodeService {
  /** 节点唯一标识 */
  nodeId: string
  /** 节点展示名 */
  nodeName: string
  /** 当前正在执行的任务 id，空串表示空闲 */
  private readonly logger = new Logger(ComputeNodeService.name)
  private lastMetricsWarning = 0
  currentTaskId = ''
  /** 最近一次任务失败信息，空串表示无异常 */
  lastError = ''

  constructor(
    private readonly clickhouseService: ClickHouseService,
    // 可选注入：单测直接 new 出来的实例没有 RedisService，任务去重逻辑自动跳过
    @Optional() private readonly redisService?: RedisService,
  ) {
    // NODE_ID 未设置时按主机名生成稳定 id：同一机器/容器重启后 id 不变，
    // 拓扑图上不会每次重启都多出一个离线节点；docker/k8s 多副本主机名天然不同，无需额外配置；
    // 同一台机器起多个进程做压测时，需显式设置不同的 NODE_ID 区分
    this.nodeId = process.env.NODE_ID || `node-${normalizeHostname()}`
    this.nodeName = process.env.NODE_NAME || this.nodeId
  }

  /** 采集节点资源与运行状态，用于注册帧/心跳帧 */
  getLocalNodeInfo() {
    this.recordMetric(() => recordRuntimeMetric(this.redisService.getClient(), 'processing', 0))
    return collectNodeInfo(this.currentTaskId)
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

  // 执行任务并通过 progressSubject 推送进度
  async executeTask(task: ComputeTask, progressSubject: Subject<ProgressUpdate>) {
    this.currentTaskId = task.task_id
    const startTime = Date.now()
    this.logger.log(`[清洗] 任务 ${task.task_id} 开始执行（session: ${task.session_id}，日期: ${task.date}）`)
    try {
      // 任务级幂等：总服务重复下发同一 task_id 时只执行一次，
      // SET NX EX 86400 已存在则视为已成功重放，跳过执行并直接推 completed:true 进度
      if (this.redisService) {
        const isNewTask = await this.redisService.setNx(`clean:task:${task.task_id}`, '1', 86400)
        if (!isNewTask) {
          this.logger.log(`[清洗] 任务 ${task.task_id} 已处理过（重复下发），直接标记完成`)
          progressSubject.next({
            task_id: task.task_id,
            node_id: this.nodeId,
            target: 0,
            progress: 0,
            message: '任务已处理过（重复下发），直接标记完成',
            completed: true,
            error: '',
            failed: false,
          })
          return
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

      // 执行归因计算，扫描过程中逐条推送进度
      const result = computeAttribution(eventList, (processed, total) => {
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
      })

      this.logger.log(`[清洗] 任务 ${task.task_id} 归因完成：${result.finalEvents.length} 条清洗事件、${result.attributions.length} 条归因记录，开始落库`)

      // 保证任务原子性，统一执行落库
      await Promise.all([
        this.clickhouseService.insert('final_event_log', result.finalEvents).then(() => {
          this.recordMetric(() => recordRuntimeMetric(this.redisService.getClient(), 'processing', result.finalEvents.length))
        }),
        this.clickhouseService.insert('event_attribution', result.attributions),
      ])

      this.recordMetric(() => recordCleaningOutcome(this.redisService.getClient(), true))

      this.logger.log(`[清洗] 任务 ${task.task_id} 完成，落库 ${result.finalEvents.length} 条清洗事件，耗时 ${Date.now() - startTime}ms`)

      // TODO 手动回滚逻辑

      this.lastError = ''

      // 任务结束只发送一条 completed:true 的进度，不要 complete() 共享流，
      // 共享 Subject 的生命周期与整个连接一致，complete 后后续任务将无法再推送进度
      progressSubject.next({
        task_id: task.task_id,
        node_id: this.nodeId,
        target: eventList.length,
        progress: eventList.length,
        message: '任务完成',
        completed: true,
        error: '',
        failed: false,
      })
    } catch (e) {
      this.recordMetric(() => recordCleaningOutcome(this.redisService.getClient(), false))
      const error = e instanceof Error ? e.message : String(e)
      this.lastError = error
      this.logger.error(`[清洗] 任务 ${task.task_id} 执行失败：${error}`)
      // 任务失败时通过进度流推送失败状态，避免静默失败
      progressSubject.next({
        task_id: task.task_id,
        node_id: this.nodeId,
        target: 0,
        progress: 0,
        message: '',
        completed: false,
        error,
        failed: true,
      })
    } finally {
      this.currentTaskId = ''
    }
  }
}
