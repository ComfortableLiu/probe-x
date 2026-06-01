import { Injectable, Logger } from '@nestjs/common'
import { ClickHouseService, RedisService } from '@probe-x/shared-utils/src/lib/backend-common'
import {
  IHomepageOverview,
  IHomepageTrend,
  IRealtimeEventsResponse,
} from '@probe-x/shared-types/src'

const CACHE_PREFIX = 'homepage:'
const OVERVIEW_CACHE_TTL = 60   // 60 seconds
const TREND_CACHE_TTL = 120     // 2 minutes
const REALTIME_CACHE_TTL = 10   // 10 seconds

@Injectable()
export class HomepageService {
  private readonly logger = new Logger(HomepageService.name)

  constructor(
    private readonly clickhouseService: ClickHouseService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * 获取首页聚合统计
   */
  async getOverview(): Promise<IHomepageOverview> {
    const cacheKey = `${CACHE_PREFIX}overview`

    // 尝试缓存
    try {
      const cached = await this.redisService.get<IHomepageOverview>(cacheKey)
      if (cached) return cached
    } catch (e) {
      // cache miss, continue
    }

    try {
      const [
        todayEventCount,
        activeUserCount,
        newUserCount,
        yesterdayEventCount,
        yesterdayActiveUserCount,
        weekEventCount,
        totalEventCount,
        retentionData,
      ] = await Promise.all([
        this.getTodayEventCount(),
        this.getActiveUserCount(),
        this.getNewUserCount(),
        this.getYesterdayEventCount(),
        this.getYesterdayActiveUserCount(),
        this.getWeekEventCount(),
        this.getTotalEventCount(),
        this.getUserRetentionRate(),
      ])

      // 计算事件趋势环比变化率
      const eventTrendChange = yesterdayEventCount > 0
        ? Math.round(((todayEventCount - yesterdayEventCount) / yesterdayEventCount) * 10000) / 100
        : 0

      const result: IHomepageOverview = {
        todayEventCount,
        activeUserCount,
        newUserCount,
        funnelConversionRate: 0, // 需要漏斗配置，暂返回0
        eventTrendChange,
        userRetentionRate: retentionData,
        yesterdayEventCount,
        yesterdayActiveUserCount,
        weekEventCount,
        totalEventCount,
      }

      // 写入缓存
      try {
        await this.redisService.set(cacheKey, result, OVERVIEW_CACHE_TTL)
      } catch (e) {
        // cache write failure is non-critical
      }

      return result
    } catch (error) {
      this.logger.error('Error fetching homepage overview:', error)
      // 返回默认值
      return {
        todayEventCount: 0,
        activeUserCount: 0,
        newUserCount: 0,
        funnelConversionRate: 0,
        eventTrendChange: 0,
        userRetentionRate: 0,
        yesterdayEventCount: 0,
        yesterdayActiveUserCount: 0,
        weekEventCount: 0,
        totalEventCount: 0,
      }
    }
  }

  /**
   * 获取趋势数据
   */
  async getTrend(days: number = 7): Promise<IHomepageTrend> {
    // 限制范围，防止恶意输入
    const safeDays = Math.min(Math.max(Math.floor(days), 1), 365)
    const cacheKey = `${CACHE_PREFIX}trend:${safeDays}`

    try {
      const cached = await this.redisService.get<IHomepageTrend>(cacheKey)
      if (cached) return cached
    } catch (e) {
      // cache miss
    }

    try {
      const rows = await this.clickhouseService.query<{
        date: string
        event_count: string
        active_user_count: string
      }>(`
        SELECT
          toString(toDate(\`$service_time\`)) as date,
          toString(count(*)) as event_count,
          toString(uniq(\`$device_id\`)) as active_user_count
        FROM final_event_log
        WHERE toDate(\`$service_time\`) >= today() - {days:UInt32}
        GROUP BY date
        ORDER BY date ASC
      `, { days: safeDays })

      const result: IHomepageTrend = {
        dates: rows.map((r) => r.date),
        eventCounts: rows.map((r) => parseInt(r.event_count || '0', 10)),
        activeUserCounts: rows.map((r) => parseInt(r.active_user_count || '0', 10)),
      }

      try {
        await this.redisService.set(cacheKey, result, TREND_CACHE_TTL)
      } catch (e) {
        // non-critical
      }

      return result
    } catch (error) {
      this.logger.error('Error fetching homepage trend:', error)
      return { dates: [], eventCounts: [], activeUserCounts: [] }
    }
  }

  /**
   * 获取实时事件流
   */
  async getRealtimeEvents(limit: number = 20): Promise<IRealtimeEventsResponse> {
    // 限制范围，防止恶意输入
    const safeLimit = Math.min(Math.max(Math.floor(limit), 1), 100)
    const cacheKey = `${CACHE_PREFIX}realtime:${safeLimit}`

    try {
      const cached = await this.redisService.get<IRealtimeEventsResponse>(cacheKey)
      if (cached) return cached
    } catch (e) {
      // cache miss
    }

    try {
      const [listResult, totalResult] = await Promise.all([
        this.clickhouseService.query<{
          event_name: string
          device_id: string
          path: string
          ip: string
          service_time: string
        }>(`
          SELECT
            toString(\`$event_name\`) as event_name,
            toString(\`$device_id\`) as device_id,
            toString(\`$path\`) as path,
            toString(\`$ip\`) as ip,
            toString(\`$service_time\`) as service_time
          FROM final_event_log
          ORDER BY \`$service_time\` DESC
          LIMIT {limit:UInt32}
        `, { limit: safeLimit }),
        this.clickhouseService.query<{ count: string }>(`
          SELECT toString(count(*)) as count
          FROM final_event_log
          WHERE toDate(\`$service_time\`) = today()
        `),
      ])

      const result: IRealtimeEventsResponse = {
        list: listResult.map((r) => ({
          eventName: r.event_name || '',
          deviceId: r.device_id || '',
          path: r.path || '',
          ip: r.ip || '',
          serviceTime: r.service_time || '',
        })),
        total: parseInt(totalResult[0]?.count || '0', 10),
      }

      try {
        await this.redisService.set(cacheKey, result, REALTIME_CACHE_TTL)
      } catch (e) {
        // non-critical
      }

      return result
    } catch (error) {
      this.logger.error('Error fetching realtime events:', error)
      return { list: [], total: 0 }
    }
  }

  // ==================== Private Helper Methods ====================

  private async getTodayEventCount(): Promise<number> {
    try {
      const result = await this.clickhouseService.query<{ count: string }>(`
        SELECT toString(count(*)) as count
        FROM final_event_log
        WHERE toDate(\`$service_time\`) = today()
      `)
      return parseInt(result[0]?.count || '0', 10)
    } catch { return 0 }
  }

  private async getActiveUserCount(): Promise<number> {
    try {
      const result = await this.clickhouseService.query<{ count: string }>(`
        SELECT toString(uniq(\`$device_id\`)) as count
        FROM final_event_log
        WHERE toDate(\`$service_time\`) = today()
      `)
      return parseInt(result[0]?.count || '0', 10)
    } catch { return 0 }
  }

  private async getNewUserCount(): Promise<number> {
    try {
      const result = await this.clickhouseService.query<{ count: string }>(`
        SELECT toString(count(*)) as count
        FROM (
          SELECT \`$device_id\`, min(toDate(\`$service_time\`)) as first_day
          FROM final_event_log
          GROUP BY \`$device_id\`
          HAVING first_day = today()
        )
      `)
      return parseInt(result[0]?.count || '0', 10)
    } catch { return 0 }
  }

  private async getYesterdayEventCount(): Promise<number> {
    try {
      const result = await this.clickhouseService.query<{ count: string }>(`
        SELECT toString(count(*)) as count
        FROM final_event_log
        WHERE toDate(\`$service_time\`) = yesterday()
      `)
      return parseInt(result[0]?.count || '0', 10)
    } catch { return 0 }
  }

  private async getYesterdayActiveUserCount(): Promise<number> {
    try {
      const result = await this.clickhouseService.query<{ count: string }>(`
        SELECT toString(uniq(\`$device_id\`)) as count
        FROM final_event_log
        WHERE toDate(\`$service_time\`) = yesterday()
      `)
      return parseInt(result[0]?.count || '0', 10)
    } catch { return 0 }
  }

  private async getWeekEventCount(): Promise<number> {
    try {
      const result = await this.clickhouseService.query<{ count: string }>(`
        SELECT toString(count(*)) as count
        FROM final_event_log
        WHERE toDate(\`$service_time\`) >= today() - 7
      `)
      return parseInt(result[0]?.count || '0', 10)
    } catch { return 0 }
  }

  private async getTotalEventCount(): Promise<number> {
    try {
      const result = await this.clickhouseService.query<{ count: string }>(`
        SELECT toString(count(*)) as count
        FROM final_event_log
      `)
      return parseInt(result[0]?.count || '0', 10)
    } catch { return 0 }
  }

  /**
   * 计算用户留存率：7天前活跃用户中，今天仍然活跃的比例
   */
  private async getUserRetentionRate(): Promise<number> {
    try {
      const result = await this.clickhouseService.query<{ rate: string }>(`
        SELECT toString(
          round(
            uniqIf(\`$device_id\`, toDate(\`$service_time\`) = today()) * 100.0 /
            nullIf(uniqIf(\`$device_id\`, toDate(\`$service_time\`) = today() - 7), 0),
            2
          )
        ) as rate
        FROM final_event_log
        WHERE toDate(\`$service_time\`) IN (today() - 7, today())
      `)
      return parseFloat(result[0]?.rate || '0')
    } catch { return 0 }
  }
}
