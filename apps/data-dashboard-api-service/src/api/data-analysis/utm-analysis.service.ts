import { Inject, Injectable } from '@nestjs/common'
import {
  IUtmAnalysisReq,
  IUtmAnalysisRes,
  IUtmAnalysisRow,
  IQueryDownloadTaskRes,
  IUser,
} from "@probe-x/shared-types/src"
import { BusinessException, ClickHouseService, RedisService } from "@probe-x/shared-utils/src/lib/backend-common"
import { v4 as uuidv4 } from "uuid"
import {
  DOWNLOAD_TASK_KEY,
  IDownloadTask,
  ISqlGenerateResult,
  QUEUE_NAME,
  QUEUE_TASK_NAME,
} from "@src/api/data-analysis/type"
import { InjectQueue } from '@nestjs/bullmq'
import { Queue } from "bullmq"
import {
  generateUtmAnalysisSql,
  generateUtmSummarySql,
} from "@src/api/data-analysis/UtmAnalysisSqlBuilder"
import { UtmService } from "@src/api/utm/utm.service"
import { DataAnalysisRecordService } from "./record.service"

@Injectable()
export class UtmAnalysisService {
  constructor(
    private readonly clickhouseService: ClickHouseService,
    private readonly redisService: RedisService,
    @InjectQueue(QUEUE_NAME)
    private readonly exportQueue: Queue,
    @Inject(DataAnalysisRecordService) private readonly dataAnalysisRecordService: DataAnalysisRecordService,
    private readonly utmService: UtmService,
  ) {
  }

  /**
   * UTM 分析 - 查询
   *
   * 分组行与区间合计一起出。合计必须单独查一次：
   * 用户数/会话数是 uniq 口径，按天列相加会重复计数
   */
  async query(data: IUtmAnalysisReq, user: IUser): Promise<IUtmAnalysisRes> {
    const ignored = await this.utmService.getIgnoredValues()

    const groupResult = this.buildSql(() => generateUtmAnalysisSql(data, ignored))
    const summaryResult = this.buildSql(() => generateUtmSummarySql(data, ignored))

    const [rows, summaryRows] = await Promise.all([
      this.clickhouseService.query<IUtmAnalysisRow>(groupResult.sql, groupResult.params),
      this.clickhouseService.query<IUtmAnalysisRow>(summaryResult.sql, summaryResult.params),
    ])

    return {
      rows: this.toRowList(rows),
      summary: this.toRowList(summaryRows)[0] || {},
    }
  }

  /**
   * UTM 分析 - 创建数据下载
   * 只导出分组行，与页面汇总表的行一致
   */
  async createDownloadTask(data: IUtmAnalysisReq, user: IUser) {
    const taskId = uuidv4()
    const ignored = await this.utmService.getIgnoredValues()
    const { sql, params } = this.buildSql(() => generateUtmAnalysisSql(data, ignored))

    const taskData: IDownloadTask = {
      taskId,
      sql,
      sqlParams: params,
      downloadUrl: '',
      status: 'RUNNING',
      createTime: Date.now(),
    }

    // 记录任务
    await this.dataAnalysisRecordService.recordTask(taskId, 'UTM 分析数据导出', user, JSON.stringify(data))

    // 任务加入 BullMQ 队列（异步执行）
    await this.exportQueue.add(QUEUE_TASK_NAME, taskData, { jobId: taskId })
    // 任务状态写入 Redis，设置 24h TTL 防止无限堆积
    await this.redisService.set(DOWNLOAD_TASK_KEY + taskId, taskData, 60 * 60 * 24)
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

  /**
   * 生成 SQL 并校验，失败直接抛业务异常
   */
  private buildSql(generate: () => ISqlGenerateResult): ISqlGenerateResult {
    const result = generate()
    if (result.error) {
      throw new BusinessException(result.error)
    }
    if (!result.sql || result.sql.trim() === '') {
      throw new BusinessException('生成的SQL语句为空')
    }
    return result
  }

  /**
   * 归一化查询结果
   *
   * 指标列（m_*）是 UInt64，ClickHouse JSON 输出可能是数字也可能是字符串，统一收成数字。
   * 维度列是取值原文，即使是纯数字串也要原样保留 —— 活动名 "2024" 不能变成 2024
   */
  private toRowList(rows: IUtmAnalysisRow | IUtmAnalysisRow[] | null | undefined): IUtmAnalysisRow[] {
    if (!rows) return []
    const list = Array.isArray(rows) ? rows : [rows]

    return list.map(row => {
      const result: IUtmAnalysisRow = {}
      Object.keys(row).forEach(key => {
        const value = row[key]
        if (key.startsWith('m_') && (typeof value === 'string' || typeof value === 'number')) {
          result[key] = Number(value) || 0
        } else {
          result[key] = value
        }
      })
      return result
    })
  }
}
