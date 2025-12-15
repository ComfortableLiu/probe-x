import { Injectable } from '@nestjs/common'
import {
  GenericEventAnalysisResult,
  IEventAnalysisReq,
  IQueryDownloadTaskRes,
  ISubmitDownloadTaskReq,
} from "@probe-x/shared-types/src"
import { BusinessException, ClickHouseService, RedisService } from "@probe-x/shared-utils/src/lib/backend-common"
import { v4 as uuidv4 } from "uuid"
import { DOWNLOAD_TASK_KEY, IDownloadTask, QUEUE_NAME, QUEUE_TASK_NAME } from "@src/api/data-analysis/type"
import { InjectQueue } from "@nestjs/bullmq"
import { Queue } from "bullmq"
import { generateEventAnalysisSql } from "@src/api/data-analysis/EventAnalysisSqlBuilder"

@Injectable()
export class EventAnalysisService {
  constructor(
    private readonly clickhouseService: ClickHouseService,
    private readonly redisService: RedisService,
    @InjectQueue(QUEUE_NAME)
    private readonly exportQueue: Queue,
  ) {
  }

  async queryEvent(data: IEventAnalysisReq): Promise<GenericEventAnalysisResult[]> {
    // 拼接SQL语句
    const { sql, params, error } = generateEventAnalysisSql(data)
    //
    // console.log('SQL语句：', sql)
    // console.log('SQL参数：', params)

    const result = await this.clickhouseService.query<GenericEventAnalysisResult[]>(sql, params)

    console.log('数据查询结果：', result)
    if (!result || result.length === 0) {
      return []
    }
    return result[0]
  }

  async createDownloadTask(data: ISubmitDownloadTaskReq) {
    const taskId = uuidv4()
    // 拼接SQL语句
    const { sql, params, error } = generateEventAnalysisSql(data)

    if (error) {
      throw new BusinessException(error)
    }

    const taskData: IDownloadTask = {
      taskId,
      sql,
      sqlParams: params,
      downloadUrl: '',
      status: 'RUNNING',
      createTime: Date.now(),
    }

    // 任务加入 BullMQ 队列（异步执行）
    const res = await this.exportQueue.add(QUEUE_TASK_NAME, taskData, { jobId: taskId })
    await this.redisService.set(DOWNLOAD_TASK_KEY + taskId, taskData)
    return {
      taskId,
    }
  }

  async queryDownloadTask(taskId: string): Promise<IQueryDownloadTaskRes> {
    const res = await this.redisService.get<IDownloadTask>(DOWNLOAD_TASK_KEY + taskId)
    if (!res) {
      throw new BusinessException('任务不存在')
    }
    return {
      status: res.status,
      downloadUrl: res.downloadUrl,
    }
  }
}
