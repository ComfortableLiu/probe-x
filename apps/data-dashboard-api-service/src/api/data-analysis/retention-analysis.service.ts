import { Inject, Injectable } from '@nestjs/common'
import {
  IQueryDownloadTaskRes,
  IRetentionAnalysisReq,
  IRetentionAnalysisRes,
  IRetentionCohortData,
  IRetentionWindowData,
  ISubmitDownloadTaskReq,
  IUser,
} from "@probe-x/shared-types/src"
import { BusinessException, ClickHouseService, RedisService } from "@probe-x/shared-utils/src/lib/backend-common"
import { v4 as uuidv4 } from "uuid"
import { DOWNLOAD_TASK_KEY, IDownloadTask, QUEUE_NAME, QUEUE_TASK_NAME } from "@src/api/data-analysis/type"
import { InjectQueue } from "@nestjs/bullmq"
import { Queue } from "bullmq"
import { generateRetentionAnalysisSql } from "@src/api/data-analysis/RetentionAnalysisSqlBuilder"
import { DataAnalysisRecordService } from "./record.service"

@Injectable()
export class RetentionAnalysisService {
  constructor(
    private readonly clickhouseService: ClickHouseService,
    private readonly redisService: RedisService,
    @InjectQueue(QUEUE_NAME)
    private readonly exportQueue: Queue,
    @Inject(DataAnalysisRecordService) private readonly dataAnalysisRecordService: DataAnalysisRecordService,
  ) {
  }

  /**
   * 查询留存分析数据
   */
  async queryRetention(data: IRetentionAnalysisReq, user: IUser): Promise<IRetentionAnalysisRes> {
    // 拼接SQL语句
    const { sql, params, error } = generateRetentionAnalysisSql(data)

    // 检查SQL生成错误
    if (error) {
      throw new BusinessException(error)
    }

    // 检查SQL是否为空
    if (!sql || sql.trim() === '') {
      throw new BusinessException('生成的SQL语句为空')
    }

    const result = await this.clickhouseService.query<any>(sql, params)

    if (!result || !Array.isArray(result) || result.length === 0) {
      return {
        cohorts: [],
        summary: {
          totalUsers: 0,
          avgRetentionRates: data.retentionWindows.map(day => ({
            day,
            retentionUsers: 0,
            retentionRate: 0,
          })),
        },
      }
    }

    // 转换结果格式
    const cohorts: IRetentionCohortData[] = result.map((row: any) => {
      const cohortSize = Number(row.cohort_size) || 0
      const windows: IRetentionWindowData[] = data.retentionWindows.map(day => {
        const retentionUsers = Number(row[`retention_users_${day}d`]) || 0
        const retentionRate = Number(row[`retention_rate_${day}d`]) || 0
        return {
          day,
          retentionUsers,
          retentionRate,
        }
      })

      return {
        cohortDate: row.cohort_date,
        cohortSize,
        windows,
      }
    })

    // 计算汇总数据
    const totalUsers = cohorts.reduce((sum, c) => sum + c.cohortSize, 0)
    const avgRetentionRates: IRetentionWindowData[] = data.retentionWindows.map(day => {
      const rates = cohorts
        .map(c => c.windows.find(w => w.day === day))
        .filter((w): w is IRetentionWindowData => w !== undefined && w.retentionRate > 0)

      const avgRate = rates.length > 0
        ? rates.reduce((sum, w) => sum + w.retentionRate, 0) / rates.length
        : 0

      const totalRetentionUsers = cohorts.reduce((sum, c) => {
        const w = c.windows.find(w => w.day === day)
        return sum + (w?.retentionUsers || 0)
      }, 0)

      return {
        day,
        retentionUsers: totalRetentionUsers,
        retentionRate: Math.round(avgRate * 100) / 100,
      }
    })

    return {
      cohorts,
      summary: {
        totalUsers,
        avgRetentionRates,
      },
    }
  }

  /**
   * 创建留存分析数据下载任务
   */
  async createDownloadTask(data: IRetentionAnalysisReq, user: IUser) {
    const taskId = uuidv4()
    // 拼接SQL语句
    const { sql, params, error } = generateRetentionAnalysisSql(data)

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
    await this.dataAnalysisRecordService.recordTask(taskId, '留存分析数据导出', user, JSON.stringify(data))

    // 任务加入 BullMQ 队列（异步执行）
    const res = await this.exportQueue.add(QUEUE_TASK_NAME, taskData, { jobId: taskId })
    await this.redisService.set(DOWNLOAD_TASK_KEY + taskId, taskData)
    return {
      taskId,
    }
  }

  /**
   * 查询下载任务进度
   */
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
