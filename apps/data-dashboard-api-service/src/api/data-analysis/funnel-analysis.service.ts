import { Inject, Injectable } from '@nestjs/common'
import { IFunnelAnalysisReq, IFunnelAnalysisRes, IQueryDownloadTaskRes, ISubmitDownloadTaskReq, ISubmitDownloadTaskRes, IUser } from "@probe-x/shared-types/src"
import { BusinessException, ClickHouseService, RedisService } from "@probe-x/shared-utils/src/lib/backend-common"
import { generateFunnelAnalysisSql } from "./FunnelAnalysisSqlBuilder"
import { DataAnalysisRecordService } from "./record.service"
import { v4 as uuidv4 } from "uuid"
import { DOWNLOAD_TASK_KEY, IDownloadTask, QUEUE_NAME, QUEUE_TASK_NAME } from "@src/api/data-analysis/type"
import { InjectQueue } from "@nestjs/bullmq"
import { Queue } from "bullmq"

@Injectable()
export class FunnelAnalysisService {
  constructor(
    private readonly clickhouseService: ClickHouseService,
    private readonly redisService: RedisService,
    @InjectQueue(QUEUE_NAME)
    private readonly exportQueue: Queue,
    @Inject(DataAnalysisRecordService) private readonly dataAnalysisRecordService: DataAnalysisRecordService,
  ) {
  }

  async queryEvent(data: IFunnelAnalysisReq, user: IUser): Promise<IFunnelAnalysisRes> {
    // 拼接SQL语句
    const { sql, params, error } = generateFunnelAnalysisSql(data)

    // console.log('SQL语句：', sql)
    // console.log('SQL参数：', params)
    // console.log('SQL错误：', error)

    // 检查SQL生成错误
    if (error) {
      throw new BusinessException(error)
    }

    // 检查SQL是否为空
    if (!sql || sql.trim() === '') {
      throw new BusinessException('生成的SQL语句为空')
    }

    // const result = [
    //   {
    //     "$device": "rwr",
    //     "1111": 217,  // 步骤1（stepName="1111"，page_leave事件）符合条件的事件数
    //     "2": 132,      // 步骤2（stepName="2"，page_load事件+device_id=12312+duration=323）且跟随步骤1的事件数
    //     "3333": 89,     // 步骤3（stepName="3333"，page_view事件）且跟随步骤2的事件数
    //   },
    // ]
    const result = await this.clickhouseService.query<any>(sql, params)
    // console.log('数据查询结果：', result)
    return result
  }

  async createDownloadTask(data: ISubmitDownloadTaskReq, user: IUser) {
    const taskId = uuidv4()
    // 拼接SQL语句
    const { sql, params, error } = generateFunnelAnalysisSql(data as unknown as IFunnelAnalysisReq)

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
    await this.dataAnalysisRecordService.recordTask(taskId, '漏斗分析数据导出', user, JSON.stringify(data))

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