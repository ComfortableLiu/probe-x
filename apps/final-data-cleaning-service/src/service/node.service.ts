import { Injectable } from '@nestjs/common'
import { GrpcStreamMethod } from '@nestjs/microservices'
import { interval, Observable, Subject, takeWhile } from 'rxjs'
import { tap } from 'rxjs/operators'
import { ClickHouseService } from "@probe-x/shared-utils/src/lib/backend-common"
import { convertObjectToAttribution } from "@probe-x/shared-utils/src"
import { IAttribution, IAttributionInfo, IPreEventLog } from "@probe-x/shared-types/src"

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
        WHERE toDate(\`$service_time\`) = :queryDate
          AND $session_id = :sessionId;
    `

    return this.clickhouseService.query<IPreEventLog>(sql, {
      queryDate: date,
      sessionId: sessionId,
    })
  }

  // 执行任务并通过 progressSubject 推送进度
  private async executeTask(task: ComputeTask, progressSubject: Subject<ProgressUpdate>) {
    // 正在处理第几个事件
    let progress = 0

    // 拿到所有事件
    const eventList = await this.getAllEvents(task.date, task.session_id)

    // 开启一个页面数据map，记录每一个页面的归因参数，保存的当前页面的
    const attributionDataMap = new Map<string, IAttributionInfo>()

    // 明确一点，map需要存当前页面的所有归因参数，不然前置归因参数会变
    // 场景：a->b，回退到a，a->c，这时候a的归因参数会变成c入口信息

    // 从第一个事件向后扫描
    eventList.forEach((item, index) => {
      progress = index + 1
      // 看一下当前事件是否是更新归因逻辑的事件，如果是的话，就需要更新当前归因数据
      // 产生路由事件并且是前进或重定向等打开新页面的行为，就更新当前归因逻辑，但是
      if (item.$is_attribution_event && item.$target_page_id) {
        // 从上个页面取出来，加上一起来的数据，存到目标页面的数据中
        // 累计的归因数据，路由事件的page_id就是下个页面的source_page_id
        const sourceAttributionData = attributionDataMap.get(item.$page_id) || []
        // 事件中传的除了spm scm以外的其他参数
        // item.$ex_attribution_params
        // 目标页面id
        // item.$target_page_id

        // 计算当前页面的归因数据
        const currentPageAttributionData = {
          $spm: item.$spm,
          $spm_a: item.$spm_a,
          $spm_b: item.$spm_b,
          $spm_c: item.$spm_c,
          $spm_d: item.$spm_d,
          $spm_a_description: item.$spm_a_description,
          $spm_b_description: item.$spm_b_description,
          $spm_c_description: item.$spm_c_description,
          $spm_d_description: item.$spm_d_description,
          $scm: item.$scm,
          $scm_a: item.$scm_a,
          $scm_b: item.$scm_b,
          $scm_c: item.$scm_c,
          $scm_d: item.$scm_d,
          $scm_a_description: item.$scm_a_description,
          $scm_b_description: item.$scm_b_description,
          $scm_c_description: item.$scm_c_description,
          $scm_d_description: item.$scm_d_description,
          // 再加上其他归因字段
          ...item.$ex_attribution_params,
        }
        sourceAttributionData.push({
          serviceTime: item.$service_time,
          ...currentPageAttributionData,
        })
        // 先存到map中，等全部计算完成后统一落库
        attributionDataMap.set(item.$target_page_id, sourceAttributionData)
      }
    })

    // 保证任务原子性，在外面统一执行落库
    const attributionList: IAttribution[] = []
    attributionDataMap.forEach((value, key) => {
      value.forEach((item, index) => {
        attributionList.push(...convertObjectToAttribution(item, item.serviceTime, key, index))
      })
    })
    const res = await Promise.all([
      this.clickhouseService.insert('final_event_log', eventList),
      this.clickhouseService.insert('event_attribution', attributionList),
    ])

    // TODO 手动回滚逻辑

    // 隔一段时间发送一次进度，毫秒
    interval(500).pipe(
      takeWhile(() => progress < eventList.length),
    ).subscribe({
      next: () => {
        progressSubject.next({
          task_id: task.task_id,
          node_id: this.nodeId,
          target: eventList.length,
          progress: progress,
          message: ``,
          completed: progress === eventList.length,
          error: '',
          failed: false,
        })
      },
      complete: () => progressSubject.complete(),
    })
  }
}
