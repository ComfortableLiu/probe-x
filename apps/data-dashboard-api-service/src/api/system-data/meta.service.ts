import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { ClickHouseService } from '@probe-x/shared-utils/src/lib/backend-common'
import {
  ISystemDataCleaningDetail,
  ISystemDataCleaningStats,
  ISystemDataMetaOverview,
  ISystemDataTrend,
} from '@probe-x/shared-types/src'
import { metricsWindow } from '@probe-x/shared-utils/src/lib/backend-common/runtime-metrics'
import { RuntimeMetricsService } from './runtime-metrics.service'

type CleaningOutcomes = Awaited<ReturnType<RuntimeMetricsService['getCleaningOutcomes']>>

const EMPTY_OUTCOME = { successRate: null, successCount: null, failCount: null }

/**
 * 元数据服务
 * 提供系统数据的元数据相关功能，包括数据概览、趋势分析、清洗统计等
 */
@Injectable()
export class MetaService {
  private readonly logger = new Logger(MetaService.name)
  private lastMetricsWarning = 0
  private outcomeCache: { key: string; at: number; data: CleaningOutcomes } | null = null
  private readonly pendingOutcomes = new Map<string, Promise<CleaningOutcomes>>()

  constructor(
    private readonly clickhouseService: ClickHouseService,
    private readonly runtimeMetrics: RuntimeMetricsService,
  ) {
  }

  /**
   * 获取元数据概览信息
   * @param date 指定日期，格式为 YYYY-MM-DD
   * @returns ISystemDataMetaOverview 元数据概览信息
   */
  async getMetaOverview(date?: string, startDate?: string, endDate?: string): Promise<ISystemDataMetaOverview> {
    const period = this.resolvePeriod(date, startDate, endDate)
    // 从ClickHouse查询元数据概览信息
    try {
      // 构建日期条件
      const dateCondition = period.startDate
        ? `AND toDate(\`$service_time\`, 'Asia/Shanghai') BETWEEN {startDate:Date} AND {endDate:Date}` : ''
      const params = period.startDate ? period : {}

      // 查询原始数据总量
      const originalDataTotalResult = await this.clickhouseService.query<{ count: string }>(
        `SELECT toString(count(*)) as count
         FROM event_log
         WHERE 1 = 1 ${dateCondition}`,
        params,
      )
      const originalDataTotal = this.formatCount(originalDataTotalResult[0]?.count || '0')

      // 查询最终清洗数据量
      const finalCleanedDataResult = await this.clickhouseService.query<{ count: string }>(
        `SELECT toString(count(*)) as count
         FROM final_event_log
         WHERE 1 = 1 ${dateCondition}`,
        params,
      )
      const finalCleanedData = this.formatCount(finalCleanedDataResult[0]?.count || '0')

      const outcomes = await this.getOutcomes(period)

      return {
        originalDataTotal,
        finalCleanedData,
        firstCleaningSuccessRate: outcomes.firstCleaning.successRate,
        finalCleaningSuccessRate: outcomes.finalCleaning.successRate,
      }
    } catch (error) {
      console.error('Error fetching meta overview:', error)
      return null
    }
  }

  /**
   * 获取数据趋势信息
   * @param days 查询天数，默认7天
   * @param startDate 开始日期，格式为 YYYY-MM-DD
   * @param endDate 结束日期，格式为 YYYY-MM-DD
   * @returns ISystemDataTrend 数据趋势信息
   */
  async getDataTrend(days: number = 7, startDate?: string, endDate?: string): Promise<ISystemDataTrend> {
    try {
      // 验证日期格式
      if (startDate && !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
        throw new Error('Invalid start date format. Expected YYYY-MM-DD')
      }
      if (endDate && !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
        throw new Error('Invalid end date format. Expected YYYY-MM-DD')
      }

      // 构建日期范围查询：传了起止日期时只用 BETWEEN 条件，否则按最近 days 天查询
      let dateCondition = ''
      let params: any
      if (startDate && endDate) {
        dateCondition = `AND toDate(\`$service_time\`) BETWEEN {startDate:String} AND {endDate:String}`
        params = { startDate, endDate }
      } else {
        dateCondition = `AND toDate(\`$service_time\`) >= today() - {days:Int32}`
        params = { days }
      }

      // 查询按日期分组的数据量趋势
      const result = await this.clickhouseService.query<{
        date: string;
        count: number;
      }>(`
          SELECT toDate(\`$service_time\`) as date,
                 count(*)                  as count
          FROM event_log
          WHERE 1 = 1 ${dateCondition}
          GROUP BY date
          ORDER BY date
      `, params)

      // 准备返回数据
      const dayNames = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
      const xAxis: string[] = []
      const data: number[] = []

      result.forEach((item, index) => {
        // 使用实际日期或默认的星期名称
        xAxis.push(item.date)
        data.push(item.count)
      })

      // 如果没有数据，使用默认数据
      if (result.length === 0) {
        return {
          xAxis: dayNames.slice(0, days),
          series: [{
            name: '上报数据量',
            data: [],
          }],
        }
      }

      return {
        xAxis,
        series: [{
          name: '上报数据量',
          data,
        }],
      }
    } catch (error) {
      console.error('Error fetching data trend:', error)
      return null
    }
  }

  /**
   * 获取清洗统计信息
   * @param date 指定日期，格式为 YYYY-MM-DD
   * @returns ISystemDataCleaningStats 清洗统计信息
   */
  async getCleaningStats(date?: string, startDate?: string, endDate?: string): Promise<ISystemDataCleaningStats> {
    const outcomes = await this.getOutcomes(this.resolvePeriod(date, startDate, endDate))
    return {
      firstCleaning: this.formatOutcome(outcomes.firstCleaning),
      finalCleaning: this.formatOutcome(outcomes.finalCleaning),
    }
  }

  /**
   * 获取初次清洗详情
   * @param date 指定日期，格式为 YYYY-MM-DD
   * @returns ISystemDataCleaningDetail 初次清洗详情
   */
  async getFirstCleaningDetail(date?: string, startDate?: string, endDate?: string): Promise<ISystemDataCleaningDetail> {
    const { firstCleaning } = await this.getCleaningStats(date, startDate, endDate)
    return { ...firstCleaning, detailList: [] }
  }

  /**
   * 获取最终清洗详情
   * @param date 指定日期，格式为 YYYY-MM-DD
   * @returns ISystemDataCleaningDetail 最终清洗详情
   */
  async getFinalCleaningDetail(date?: string, startDate?: string, endDate?: string): Promise<ISystemDataCleaningDetail> {
    const { finalCleaning } = await this.getCleaningStats(date, startDate, endDate)
    return { ...finalCleaning, detailList: [] }
  }

  private resolvePeriod(date?: string, startDate?: string, endDate?: string) {
    if ((startDate && !endDate) || (!startDate && endDate)) {
      throw new BadRequestException('开始日期和结束日期必须一起提供')
    }
    const start = startDate || date
    const end = endDate || date
    for (const day of [start, end]) {
      if (day && (!/^\d{4}-\d{2}-\d{2}$/.test(day)
        || !Number.isFinite(Date.parse(`${day}T00:00:00Z`))
        || new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) !== day)) {
        throw new BadRequestException('日期必须为有效的 YYYY-MM-DD')
      }
    }
    if (start && end && start > end) throw new BadRequestException('开始日期不能晚于结束日期')
    return { startDate: start, endDate: end }
  }

  private getOutcomes(period: { startDate?: string; endDate?: string }): Promise<CleaningOutcomes> {
    const start = period.startDate || metricsWindow().today
    const end = period.endDate || start
    const key = `${start}:${end}`
    if (this.outcomeCache?.key === key && Date.now() - this.outcomeCache.at < 1000) {
      return Promise.resolve(this.outcomeCache.data)
    }
    const existing = this.pendingOutcomes.get(key)
    if (existing) return existing
    const pending = this.runtimeMetrics.getCleaningOutcomes(start, end).catch(() => {
      if (Date.now() - this.lastMetricsWarning > 60000) {
        this.lastMetricsWarning = Date.now()
        this.logger.warn('清洗结果采样暂不可用')
      }
      return { firstCleaning: { ...EMPTY_OUTCOME }, finalCleaning: { ...EMPTY_OUTCOME } }
    }).then(data => {
      this.outcomeCache = { key, at: Date.now(), data }
      return data
    }).finally(() => { this.pendingOutcomes.delete(key) })
    this.pendingOutcomes.set(key, pending)
    return pending
  }

  private formatOutcome(outcome: CleaningOutcomes['firstCleaning']) {
    return {
      successRate: outcome.successRate,
      successCount: outcome.successCount === null ? '—' : this.formatCount(String(outcome.successCount)),
      failCount: outcome.failCount === null ? '—' : this.formatCount(String(outcome.failCount)),
    }
  }

  // 格式化计数
  private formatCount(count: string): string {
    const num = parseInt(count, 10)
    if (isNaN(num)) return '0'

    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}k`
    } else {
      return num.toString()
    }
  }

}
