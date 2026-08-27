import { Injectable, Optional } from '@nestjs/common'
import { GrpcStreamMethod } from '@nestjs/microservices'
import { Observable, Subject } from 'rxjs'
import { tap } from 'rxjs/operators'
import { ClickHouseService, RedisService } from "@probe-x/shared-utils/src/lib/backend-common"
import { IPreEventLog } from "@probe-x/shared-types/src"
import { computeAttribution } from "../lib/attribution-engine"

// 类型定义
export interface ComputeTask {
  task_id: string;
  session_id: string;
  date: string;
}

export interface ProgressUpdate {
  // 关联的任务ID
  task_id: string;
  // 目标进度
  target: number;
  // 总进度
  progress: number;
  // 节点唯一标识
  node_id: string;
  // 附加信息（如“正在处理第3个分片”）
  message: string;
  // 是否完成
  completed: boolean;
  // 是否失败
  failed: boolean;
  // 失败信息
  error: string;
}

@Injectable()
export class ComputeNodeService {
  nodeId: string

  constructor(
    private readonly clickhouseService: ClickHouseService,
    // 可选注入：单测直接 new 出来的实例没有 RedisService，任务去重逻辑自动跳过
    @Optional() private readonly redisService?: RedisService,
  ) {
    this.nodeId = `node-${Math.random().toString(36).slice(2, 8)}` // 节点唯一标识
  }

  // 双向流实现：接收控制中心的任务流，返回进度流
  @GrpcStreamMethod('ComputeService', 'TaskStream')
  handleTaskStream(task$: Observable<ComputeTask>): Observable<ProgressUpdate> {
    const progressSubject = new Subject<ProgressUpdate>()

    // 监听控制中心发送的任务
    task$.pipe(
      tap((task) => {
        console.log(`[节点 ${this.nodeId}] 收到控制中心任务 ${task.task_id}`)
        this.executeTask(task, progressSubject) // 执行任务并推送进度
      }),
    ).subscribe()

    return progressSubject.asObservable()
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
  private async executeTask(task: ComputeTask, progressSubject: Subject<ProgressUpdate>) {
    try {
      // 任务级幂等：控制中心重复下发同一 task_id 时只执行一次，
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

      // 任务开始即推送初始进度，保证控制中心能感知任务已被接收
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
      // 任务失败时通过进度流推送失败状态，避免静默失败
      progressSubject.next({
        task_id: task.task_id,
        node_id: this.nodeId,
        target: 0,
        progress: 0,
        message: '',
        completed: false,
        error: e instanceof Error ? e.message : String(e),
        failed: true,
      })
    }
  }
}
