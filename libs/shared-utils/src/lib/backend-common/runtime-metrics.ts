import type { Redis } from 'ioredis'

// All overview day/week/month boundaries use Asia/Shanghai, independently of host TZ.
export const METRICS_TTL_SECONDS = 35 * 86400
export const LATENCY_BUCKETS = [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 30000, 60000]
const OFFSET_MS = 8 * 3600 * 1000

export function metricsWindow(now = Date.now()) {
  const local = new Date(now + OFFSET_MS)
  const today = local.toISOString().slice(0, 10)
  const dayStart = Date.parse(`${today}T00:00:00+08:00`)
  const day = (timestamp: number) => new Date(timestamp + OFFSET_MS).toISOString().slice(0, 10)
  return {
    today,
    yesterday: day(dayStart - 86400000),
    tomorrow: day(dayStart + 86400000),
    weekStart: day(dayStart - ((local.getUTCDay() + 6) % 7) * 86400000),
    monthStart: `${today.slice(0, 7)}-01`,
    dayStart,
    minute: Math.floor((now - dayStart) / 60000),
    monthDays: Array.from({ length: local.getUTCDate() }, (_, i) => `${today.slice(0, 7)}-${String(i + 1).padStart(2, '0')}`),
  }
}

export const metricsKey = (kind: 'api' | 'processing', day: string) => `probe-x:overview:v1:${kind}:${day}`

export async function recordRuntimeMetric(
  client: Redis,
  kind: 'api' | 'processing',
  count: number,
  sample?: { duration: number; status: number; businessError: boolean },
  now = Date.now(),
): Promise<void> {
  // Do not enqueue unbounded telemetry while Redis is disconnected.
  if (client.status !== 'ready') throw new Error('监控 Redis 未就绪')
  const { today, minute } = metricsWindow(now)
  const key = metricsKey(kind, today)
  const tx = client.multi()
  tx.hsetnx(key, 'startedAt', now)
  tx.hincrby(key, 'count', count)
  tx.hincrby(key, `minute:${minute}`, count)
  if (sample) {
    const duration = Math.max(0, sample.duration)
    const bucket = LATENCY_BUCKETS.find(bound => duration <= bound) ?? 'overflow'
    const clientError = sample.status >= 400 && sample.status < 500
    const serverError = sample.status >= 500
    const businessError = sample.status < 400 && sample.businessError
    tx.hincrbyfloat(key, 'duration', duration)
    tx.hincrby(key, `latency:${bucket}`, 1)
    if (clientError) tx.hincrby(key, 'clientErrors', 1)
    if (serverError) tx.hincrby(key, 'serverErrors', 1)
    if (businessError) tx.hincrby(key, 'businessErrors', 1)
    if (clientError || serverError || businessError) {
      tx.hincrby(key, 'errors', 1)
      tx.hincrby(key, `errors:${minute}`, 1)
    }
  }
  tx.expire(key, METRICS_TTL_SECONDS)
  const result = await tx.exec()
  if (!result || result.some(([error]) => error)) throw new Error('运行指标写入失败')
}

export function histogramPercentile(histogram: Record<string, string>, percentile: number): number | null {
  const count = Number(histogram.count || 0)
  if (!count) return null
  let accumulated = 0
  for (const bucket of LATENCY_BUCKETS) {
    accumulated += Number(histogram[`latency:${bucket}`] || 0)
    if (accumulated >= Math.ceil(count * percentile)) return bucket
  }
  // The overflow bucket has no finite upper bound; never understate a slow percentile.
  return null
}

/** Final-cleaning execution outcomes; deduplicated replay is not an execution attempt. */
export async function recordCleaningOutcome(client: Redis, success: boolean, now = Date.now()): Promise<void> {
  if (client.status !== 'ready') throw new Error('监控 Redis 未就绪')
  const key = metricsKey('processing', metricsWindow(now).today)
  const result = await client.multi()
    .hincrby(key, success ? 'successfulTasks' : 'failedTasks', 1)
    .expire(key, METRICS_TTL_SECONDS)
    .exec()
  if (!result || result.some(([error]) => error)) throw new Error('清洗任务结果写入失败')
}
