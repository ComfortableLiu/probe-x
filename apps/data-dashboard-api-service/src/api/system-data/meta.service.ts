import { Injectable } from '@nestjs/common'
import { ClickHouseService } from '@probe-x/shared-utils/src/lib/backend-common'
import {
  ISystemDataCleaningDetail,
  ISystemDataCleaningStats,
  ISystemDataMetaOverview,
  ISystemDataTrend,
} from '@probe-x/shared-types/src'

/**
 * 元数据服务
 * 提供系统数据的元数据相关功能，包括数据概览、趋势分析、清洗统计等
 */
@Injectable()
export class MetaService {
  constructor(
    private readonly clickhouseService: ClickHouseService,
  ) {
  }

  /**
   * 获取元数据概览信息
   * @param date 指定日期，格式为 YYYY-MM-DD
   * @returns ISystemDataMetaOverview 元数据概览信息
   */
  async getMetaOverview(date?: string): Promise<ISystemDataMetaOverview> {
    // 从ClickHouse查询元数据概览信息
    try {
      // 验证日期格式
      if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        throw new Error('Invalid date format. Expected YYYY-MM-DD')
      }

      // 构建日期条件
      const dateCondition = date ? `AND toDate(\`$service_time\`) = {date:String}` : ''
      const params = date ? { date } : {}

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

      // 查询初次清洗成功率
      const firstCleaningSuccessRate = null // TODO 实际应用中可能需要通过比较原始数据和初次清洗数据来计算

      // 查询最终清洗成功率
      const finalCleaningSuccessRate = null // TODO 实际应用中可能需要通过比较初次清洗数据和最终清洗数据来计算

      return {
        originalDataTotal,
        finalCleanedData,
        firstCleaningSuccessRate,
        finalCleaningSuccessRate,
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

      // 构建日期范围查询
      let dateCondition = ''
      let params: any = { days: days }
      if (startDate && endDate) {
        dateCondition = `AND toDate(\`$service_time\`) BETWEEN {startDate:String} AND {endDate:String}`
        params = { ...params, startDate, endDate }
      } else {
        dateCondition = `AND toDate(\`$service_time\`) >= today() - {days:Int32}`
      }

      // 查询按日期分组的数据量趋势
      const result = await this.clickhouseService.query<{
        date: string;
        count: number;
      }>(`
          SELECT toDate(\`$service_time\`) as date,
                 count(*)                  as count
          FROM event_log
          WHERE toDate(\`$service_time\`) >= today() - {days:Int32} ${dateCondition}
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
  async getCleaningStats(date?: string): Promise<ISystemDataCleaningStats> {
    try {
      // 验证日期格式
      if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        throw new Error('Invalid date format. Expected YYYY-MM-DD')
      }

      // 构建日期条件
      const dateCondition = date ? `AND toDate(\`$service_time\`) = {date:String}` : ''
      const params = date ? { date } : {}

      // 查询初次清洗统计
      const [firstCleanResult, finalCleanResult] = await Promise.all([
        this.clickhouseService.query<{ count: string }>(
          `SELECT toString(count(*)) as count
           FROM event_log
           WHERE 1 = 1 ${dateCondition}`,
          params,
        ),
        this.clickhouseService.query<{ count: string }>(
          `SELECT toString(count(*)) as count
           FROM final_event_log
           WHERE 1 = 1 ${dateCondition}`,
          params,
        ),
      ])

      const firstCleanCount = firstCleanResult[0]?.count || '0'
      const finalCleanCount = finalCleanResult[0]?.count || '0'

      const firstSuccessRate = null
      const finalSuccessRate = null

      return {
        firstCleaning: {
          successRate: firstSuccessRate, // TODO 实际应用中需要计算成功率
          successCount: this.formatCount(firstCleanCount),
          failCount: this.calculateFailCount(firstCleanCount, firstSuccessRate),
        },
        finalCleaning: {
          successRate: finalSuccessRate, // TODO 实际应用中需要计算成功率
          successCount: this.formatCount(finalCleanCount),
          failCount: this.calculateFailCount(finalCleanCount, finalSuccessRate),
        },
      }
    } catch (error) {
      console.error('Error fetching cleaning stats:', error)
      return null
    }
  }

  /**
   * 获取初次清洗详情
   * @param date 指定日期，格式为 YYYY-MM-DD
   * @returns ISystemDataCleaningDetail 初次清洗详情
   */
  async getFirstCleaningDetail(date?: string): Promise<ISystemDataCleaningDetail> {
    try {
      // 验证日期格式
      if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        throw new Error('Invalid date format. Expected YYYY-MM-DD')
      }

      // 构建日期条件
      const dateCondition = date ? `AND toDate(\`$service_time\`) = {date:String}` : ''
      const params = date ? { date } : {}

      // 查询初次清洗详情
      const result = await this.clickhouseService.query<{ count: string }>(
        `SELECT toString(count(*)) as count
         FROM event_log
         WHERE 1 = 1 ${dateCondition}`,
        params,
      )

      const count = result[0]?.count || '0'

      // TODO
      const successRate = null

      return {
        successRate,
        successCount: this.formatCount(count),
        failCount: this.calculateFailCount(count, successRate),
        detailList: [], // 可以扩展更多详细信息
      }
    } catch (error) {
      console.error('Error fetching first cleaning detail:', error)
      return null
    }
  }

  /**
   * 获取最终清洗详情
   * @param date 指定日期，格式为 YYYY-MM-DD
   * @returns ISystemDataCleaningDetail 最终清洗详情
   */
  async getFinalCleaningDetail(date?: string): Promise<ISystemDataCleaningDetail> {
    try {
      // 验证日期格式
      if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        throw new Error('Invalid date format. Expected YYYY-MM-DD')
      }

      // 构建日期条件
      const dateCondition = date ? `AND toDate(\`$service_time\`) = {date:String}` : ''
      const params = date ? { date } : {}

      // 查询最终清洗详情
      const result = await this.clickhouseService.query<{ count: string }>(
        `SELECT toString(count(*)) as count
         FROM final_event_log
         WHERE 1 = 1 ${dateCondition}`,
        params,
      )

      const count = result[0]?.count || '0'
      // TODO
      const successRate = null

      return {
        successRate,
        successCount: this.formatCount(count),
        failCount: this.calculateFailCount(count, successRate),
        detailList: [], // 可以扩展更多详细信息
      }
    } catch (error) {
      console.error('Error fetching final cleaning detail:', error)
      return null
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

  // 计算失败数量
  private calculateFailCount(total: string, successRate: number): string {
    const totalNum = parseInt(total, 10)
    if (isNaN(totalNum)) return '0'

    const failRate = 100 - successRate
    const failCount = Math.round(totalNum * (failRate / 100))

    if (failCount >= 1000000) {
      return `${(failCount / 1000000).toFixed(1)}M`
    } else if (failCount >= 1000) {
      return `${(failCount / 1000).toFixed(1)}k`
    } else {
      return failCount.toString()
    }
  }
}
