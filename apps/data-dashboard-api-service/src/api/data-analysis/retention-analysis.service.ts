import { Inject, Injectable } from '@nestjs/common'
import {
  IQueryDownloadTaskRes,
  IRetentionAnalysisReq,
  IRetentionAnalysisRes,
  IRetentionCohortData,
  IRetentionWindowData,
  ISubmitDownloadTaskReq,
  IUser,
  RetentionGranularity,
} from "@probe-x/shared-types/src"
import { BusinessException, ClickHouseService, RedisService } from "@probe-x/shared-utils/src/lib/backend-common"
import { v4 as uuidv4 } from "uuid"
import { DOWNLOAD_TASK_KEY, IDownloadTask, QUEUE_NAME, QUEUE_TASK_NAME } from "@src/api/data-analysis/type"
import { InjectQueue } from "@nestjs/bullmq"
import { Queue } from "bullmq"
import { generateRetentionAnalysisSql } from "@src/api/data-analysis/RetentionAnalysisSqlBuilder"
import { DataAnalysisRecordService } from "./record.service"
import dayjs from "dayjs"

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
    // 留存窗口归一化（与 SQL builder 一致：去重、升序、仅保留 1-365 的整数），保证列名与结果映射对得上
    const windows = [...new Set(data.retentionWindows.filter(d => Number.isInteger(d) && d >= 1 && d <= 365))].sort((a, b) => a - b)
    // 维度列名（与 SQL builder 一致：去重并过滤空值，结果列名即原始维度名，如 $zoon）
    const dimensionFields = [...new Set((data.dimension || []).filter(field => field && field.trim() !== ''))]

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
          avgRetentionRates: windows.map(day => ({
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
      const windowData: IRetentionWindowData[] = windows.map(day => {
        const retentionUsers = Number(row[`retention_users_${day}d`]) || 0
        const retentionRate = Number(row[`retention_rate_${day}d`]) || 0
        return {
          day,
          retentionUsers,
          retentionRate,
        }
      })

      // 维度值（ClickHouse 返回的列名即原始维度名）
      const dimensionValues: Record<string, string> = {}
      dimensionFields.forEach(field => {
        const value = row[field]
        dimensionValues[field] = value === null || value === undefined ? '' : String(value)
      })

      return {
        cohortDate: row.cohort_date,
        cohortSize,
        windows: windowData,
        ...(dimensionFields.length > 0 ? { dimensionValues } : {}),
      }
    })

    // 计算汇总数据
    const totalUsers = cohorts.reduce((sum, c) => sum + c.cohortSize, 0)
    // 加权留存口径（与神策一致）：某窗口的总体留存率 = 已成熟队列在该窗口的留存人数之和 ÷ 已成熟队列的初始人数之和
    // 「已成熟」指 队列日期 + N 个粒度单位（天/周/月） <= 今天，未成熟队列该窗口尚无数据
    const today = dayjs().startOf('day')
    const dayjsUnit = data.granularity === RetentionGranularity.WEEK
      ? 'week'
      : data.granularity === RetentionGranularity.MONTH
        ? 'month'
        : 'day'
    const avgRetentionRates: IRetentionWindowData[] = windows.map(day => {
      const matureCohorts = cohorts.filter(c => !dayjs(c.cohortDate).add(day, dayjsUnit).isAfter(today))

      const totalRetentionUsers = matureCohorts.reduce((sum, c) => {
        const w = c.windows.find(w => w.day === day)
        return sum + (w?.retentionUsers || 0)
      }, 0)
      const totalCohortSize = matureCohorts.reduce((sum, c) => sum + c.cohortSize, 0)

      return {
        day,
        retentionUsers: totalRetentionUsers,
        retentionRate: totalCohortSize > 0
          ? Math.round(totalRetentionUsers * 10000 / totalCohortSize) / 100
          : 0,
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

    // 留存窗口归一化（与 SQL builder 一致：去重、升序、仅保留 1-365 的整数）
    const windows = [...new Set(data.retentionWindows.filter(d => Number.isInteger(d) && d >= 1 && d <= 365))].sort((a, b) => a - b)

    const taskData: IDownloadTask = {
      taskId,
      sql,
      sqlParams: params,
      downloadUrl: '',
      status: 'RUNNING',
      createTime: Date.now(),
      analysisType: 'retention',
      retentionWindows: windows,
      granularity: data.granularity || RetentionGranularity.DAY,
    }

    // 记录任务
    await this.dataAnalysisRecordService.recordTask(taskId, '留存分析数据导出', user, JSON.stringify(data))

    // 任务加入 BullMQ 队列（异步执行）
    const res = await this.exportQueue.add(QUEUE_TASK_NAME, taskData, { jobId: taskId })
    // 任务状态写入 Redis，设置 24h TTL 防止无限堆积
    await this.redisService.set(DOWNLOAD_TASK_KEY + taskId, taskData, 60 * 60 * 24)
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
