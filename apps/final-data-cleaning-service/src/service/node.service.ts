import { Injectable, Optional } from '@nestjs/common'
import { Subject } from 'rxjs'
import { ClickHouseService, RedisService } from "@probe-x/shared-utils/src/lib/backend-common"
import { IPreEventLog } from "@probe-x/shared-types/src"
import { computeAttribution } from "../lib/attribution-engine"
import { collectNodeInfo } from "../lib/node-info"
import type { ComputeTask, ProgressUpdate } from "../type"

// 任务流与进度流的类型定义由 ../type 统一维护，这里转出以兼容既有引用
export type { ComputeTask, ProgressUpdate } from "../type"

@Injectable()
export class ComputeNodeService {
  /** 节点唯一标识 */
  nodeId: string
  /** 节点展示名 */
  nodeName: string
  /** 当前正在执行的任务 id，空串表示空闲 */
  currentTaskId = ''
  /** 最近一次任务失败信息，空串表示无异常 */
  lastError = ''

  constructor(
    private readonly clickhouseService: ClickHouseService,
    // 可选注入：单测直接 new 出来的实例没有 RedisService，任务去重逻辑自动跳过
    @Optional() private readonly redisService?: RedisService,
  ) {
    this.nodeId = process.env.NODE_ID || `node-${Math.random().toString(36).slice(2, 8)}` // 节点唯一标识
    this.nodeName = process.env.NODE_NAME || this.nodeId
  }

  /** 采集节点资源与运行状态，用于注册帧/心跳帧 */
  getLocalNodeInfo() {
    return collectNodeInfo(this.currentTaskId)
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
    try {
      // 任务级幂等：总服务重复下发同一 task_id 时只执行一次，
      // SET NX EX 86400 已存在则视为已成功重放，跳过执行并直接推 completed:true 进度
      if (this.redisService) {
        const isNewTask = await this.redisService.setNx(`clean:task:${task.task_id}`, '1', 86400)
        if (!isNewTask) {
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

      // 保证任务原子性，统一执行落库
      await Promise.all([
        this.clickhouseService.insert('final_event_log', result.finalEvents),
        this.clickhouseService.insert('event_attribution', result.attributions),
      ])

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
      const error = e instanceof Error ? e.message : String(e)
      this.lastError = error
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
