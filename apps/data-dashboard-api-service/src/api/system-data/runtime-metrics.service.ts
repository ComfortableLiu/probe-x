import { Injectable, Logger } from '@nestjs/common'
import { RedisService } from '@probe-x/shared-utils/src/lib/backend-common'
import { ISystemPerformanceMetrics } from '@probe-x/shared-types/src'
import {
  histogramPercentile,
  metricsKey,
  metricsWindow,
  recordRuntimeMetric,
} from '@probe-x/shared-utils/src/lib/backend-common/runtime-metrics'

@Injectable()
export class RuntimeMetricsService {
  private readonly logger = new Logger(RuntimeMetricsService.name)
  private lastWarningAt = 0

  constructor(private readonly redisService: RedisService) {}

  record(duration: number, status: number, businessError: boolean): void {
    recordRuntimeMetric(this.redisService.getClient(), 'api', 1, { duration, status, businessError })
      .catch(() => {
        if (Date.now() - this.lastWarningAt > 60000) {
          this.lastWarningAt = Date.now()
          this.logger.warn('API 运行指标未能写入 Redis，此期间采样可能不完整')
        }
      })
  }

  private async read(kind: 'api' | 'processing', now: number) {
    const window = metricsWindow(now)
    const client = this.redisService.getClient()
    if (client.status !== 'ready') throw new Error('监控 Redis 未就绪')
    const tx = client.multi()
    tx.hgetall(metricsKey(kind, window.today))
    tx.hgetall(metricsKey(kind, window.yesterday))
    if (kind === 'api') {
      for (const day of window.monthDays) tx.hmget(metricsKey(kind, day), 'count', 'errors')
    }
    const result = await tx.exec()
    if (!result || result.some(([error]) => error)) throw new Error('运行指标读取失败')
    const today = result[0][1] as Record<string, string>
    const yesterday = result[1][1] as Record<string, string>
    const previousMinute = window.minute === 0 ? yesterday : today
    const minute = window.minute === 0 ? 1439 : window.minute - 1
    // A bucket is valid only if collection started before that entire minute.
    const startedAt = Number(previousMinute.startedAt)
    const minuteStart = window.dayStart + (window.minute - 1) * 60000
    const currentCount = startedAt && startedAt <= minuteStart
      ? Number(previousMinute[`minute:${minute}`] || 0) : null
    const completeMinutes = Object.entries(today)
      .filter(([key]) => key.startsWith('minute:') && Number(key.slice(7)) < window.minute
        && window.dayStart + Number(key.slice(7)) * 60000 >= Number(today.startedAt))
      .map(([, count]) => Number(count))
    return { window, today, previousMinute, minute, currentCount, completeMinutes, result }
  }

  async getPerformance(now = Date.now()): Promise<ISystemPerformanceMetrics> {
    const { today, previousMinute, minute, currentCount, completeMinutes, result } = await this.read('api', now)
    const count = Number(today.count || 0)
    const errors = Number(previousMinute[`errors:${minute}`] || 0)
    const monthly = result.slice(2).map(([, value]) => value as string[])
    const monthCount = monthly.reduce((sum, row) => sum + Number(row[0] || 0), 0)
    const monthErrors = monthly.reduce((sum, row) => sum + Number(row[1] || 0), 0)
    const rate = (n: number, total: number) => total ? Number((n / total * 100).toFixed(2)) : null
    return {
      currentQps: currentCount === null ? null : currentCount / 60,
      peakQps: completeMinutes.length ? Math.max(...completeMinutes) / 60 : currentCount === null ? null : 0,
      avgQps: today.startedAt ? count / Math.max(1, (now - Number(today.startedAt)) / 1000) : null,
      avgResponseTime: count ? Number(today.duration || 0) / count : null,
      p95ResponseTime: histogramPercentile(today, 0.95),
      p99ResponseTime: histogramPercentile(today, 0.99),
      systemAvailability: currentCount ? rate(currentCount - errors, currentCount) : null,
      currentMonthAvailability: rate(monthCount - monthErrors, monthCount),
      requestErrorRate: rate(Number(today.clientErrors || 0), count),
      systemErrorRate: rate(Number(today.serverErrors || 0), count),
      businessErrorRate: rate(Number(today.businessErrors || 0), count),
    }
  }

  async getProcessing(now = Date.now()) {
    const { today, currentCount, completeMinutes } = await this.read('processing', now)
    const successful = Number(today.successfulTasks || 0)
    const failed = Number(today.failedTasks || 0)
    return {
      finalCleaningSuccessRate: successful + failed ? successful / (successful + failed) * 100 : null,
      currentProcessing: currentCount,
      peakProcessing: completeMinutes.length ? Math.max(...completeMinutes) : currentCount === null ? null : 0,
    }
  }
}
