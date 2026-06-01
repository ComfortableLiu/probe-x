import { Inject, Injectable } from '@nestjs/common'
import {
  GenericEventAnalysisResult,
  IEventAnalysisReq,
  IQueryDownloadTaskRes,
  ISubmitDownloadTaskReq,
  IUser,
} from "@probe-x/shared-types/src"
import { BusinessException, ClickHouseService, RedisService } from "@probe-x/shared-utils/src/lib/backend-common"
import { v4 as uuidv4 } from "uuid"
import { DOWNLOAD_TASK_KEY, IDownloadTask, QUEUE_NAME, QUEUE_TASK_NAME } from "@src/api/data-analysis/type"
import { InjectQueue } from "@nestjs/bullmq"
import { Queue } from "bullmq"
import { generateEventAnalysisSql } from "@src/api/data-analysis/EventAnalysisSqlBuilder"
import { DataAnalysisRecordService } from "./record.service"

@Injectable()
export class EventAnalysisService {
  constructor(
    private readonly clickhouseService: ClickHouseService,
    private readonly redisService: RedisService,
    @InjectQueue(QUEUE_NAME)
    private readonly exportQueue: Queue,
    @Inject(DataAnalysisRecordService) private readonly dataAnalysisRecordService: DataAnalysisRecordService,
  ) {
  }

  // TODO 这里拼装sql有问题
  async queryEvent(data: IEventAnalysisReq, user: IUser): Promise<GenericEventAnalysisResult[]> {
    // 拼接SQL语句
    const { sql, params, error } = generateEventAnalysisSql(data)
    //
    // console.log('SQL语句：', sql)
    // console.log('SQL参数：', params)

    // 检查SQL生成错误
    if (error) {
      throw new BusinessException(error)
    }

    // 检查SQL是否为空
    if (!sql || sql.trim() === '') {
      throw new BusinessException('生成的SQL语句为空')
    }

    const result = await this.clickhouseService.query<GenericEventAnalysisResult | GenericEventAnalysisResult[]>(sql, params)

    // ClickHouse返回的result.json()应该是一个数组（JSONEachRow格式）
    // 但为了兼容性，如果返回的是单个对象，包装成数组
    if (!result) {
      return []
    }
    // 确保返回数组格式
    if (Array.isArray(result)) {
      return result
    }
    // 如果返回的是单个对象（可能在某些特殊情况下发生），包装成数组
    return [result as GenericEventAnalysisResult]
  }

  async createDownloadTask(data: ISubmitDownloadTaskReq, user: IUser) {
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

    // 记录任务
    await this.dataAnalysisRecordService.recordTask(taskId, '事件分析数据导出', user, JSON.stringify(data))

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
