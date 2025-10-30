import { Injectable } from '@nestjs/common'
import { GrpcStreamMethod } from '@nestjs/microservices'
import { interval, Observable, Subject, takeWhile } from 'rxjs'
import { map, tap } from 'rxjs/operators'

// 类型定义
export interface ComputeTask {
  task_id: string;
  payload: string;
  priority: number;
}

export interface ProgressUpdate {
  task_id: string;
  progress: number;
  node_id: string;
  message: string;
  completed: boolean;
}

@Injectable()
export class ComputeNodeService {
  nodeId: string

  constructor() {
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

  // 执行任务并通过 progressSubject 推送进度
  private executeTask(task: ComputeTask, progressSubject: Subject<ProgressUpdate>) {
    let progress = 0
    interval(1000).pipe(
      takeWhile(() => progress < 100),
      map(() => {
        progress += 10
        return progress > 100 ? 100 : progress
      }),
    ).subscribe({
      next: (p) => {
        progressSubject.next({
          task_id: task.task_id,
          node_id: this.nodeId,
          progress: p,
          message: `处理中（${p}%）`,
          completed: p === 100,
        })
      },
      complete: () => progressSubject.complete(),
    })
  }
}
