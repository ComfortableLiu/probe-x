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

/**
 * 清洗 session 完成计数：按自然分钟落入当日 processing hash 的 sessionMinute:{m} 桶，
 * 供总览页 session/s 速度使用。由总服务在观测到任务成功完成时写入，
 * 节点幂等跳过的重复任务（target 为 0）不计入。
 */
export async function recordCleaningSessionCompletion(client: Redis, now = Date.now()): Promise<void> {
  if (client.status !== 'ready') throw new Error('监控 Redis 未就绪')
  const { today, minute } = metricsWindow(now)
  const key = metricsKey('processing', today)
  const result = await client.multi()
    .hincrby(key, `sessionMinute:${minute}`, 1)
    .expire(key, METRICS_TTL_SECONDS)
    .exec()
  if (!result || result.some(([error]) => error)) throw new Error('清洗 session 计数写入失败')
}

export const nodeCleaningMetricsKey = (nodeId: string, day: string) =>
  `probe-x:overview:v2:nodeCleaning:${day}:${nodeId}`

export interface INodeCleaningSpeedStats {
  /** 今日节点总处理量 / 忙碌墙钟时长（条/s），并发时间仅计一次 */
  avg: number | null
  /** 今日节点采样区间的最高总处理速度（条/s） */
  max: number | null
  /** 今日节点采样区间的最低总处理速度（条/s），含忙碌停滞的 0 */
  min: number | null
}

const RECORD_NODE_CLEANING_SPEED = `
local events = tonumber(ARGV[1])
local durationMs = tonumber(ARGV[2])
local speed = events * 1000 / durationMs
redis.call('HINCRBY', KEYS[1], 'samples', 1)
redis.call('HINCRBYFLOAT', KEYS[1], 'events', ARGV[1])
redis.call('HINCRBYFLOAT', KEYS[1], 'durationMs', ARGV[2])
local maxSpeed = redis.call('HGET', KEYS[1], 'maxSpeed')
local minSpeed = redis.call('HGET', KEYS[1], 'minSpeed')
if not maxSpeed or speed > tonumber(maxSpeed) then
  redis.call('HSET', KEYS[1], 'maxSpeed', tostring(speed))
end
if not minSpeed or speed < tonumber(minSpeed) then
  redis.call('HSET', KEYS[1], 'minSpeed', tostring(speed))
end
redis.call('EXPIRE', KEYS[1], ARGV[3])
return 1
`

/**
 * 记录节点一个采样区间的总新增处理量及忙碌墙钟时长；并发任务重叠时间仅计一次。
 *
 * 调用端按自然日拆分互不重叠的采样区间，now 指定该区间所属日期。
 * events 为 0 仍是有效忙碌采样。Lua 原子更新累计量、区间极值和 TTL，
 * v2 key 隔离无法换算成节点墙钟时长的旧版单任务统计。
 */
export async function recordNodeCleaningSpeed(
  client: Redis,
  nodeId: string,
  events: number,
  durationMs: number,
  now = Date.now(),
): Promise<void> {
  if (client.status !== 'ready') throw new Error('监控 Redis 未就绪')
  if (!Number.isFinite(events) || events < 0 || !Number.isFinite(durationMs) || durationMs <= 0) return
  const key = nodeCleaningMetricsKey(nodeId, metricsWindow(now).today)
  const result = await client.eval(
    RECORD_NODE_CLEANING_SPEED,
    1,
    key,
    String(events),
    String(durationMs),
    String(METRICS_TTL_SECONDS),
  )
  if (result !== 1) throw new Error('节点清洗速度写入失败')
}

/** 批量读取多个节点当日的清洗速度统计；无记录的节点返回全 null */
export async function readNodeCleaningSpeeds(
  client: Redis,
  nodeIds: string[],
  now = Date.now(),
): Promise<Map<string, INodeCleaningSpeedStats>> {
  const stats = new Map<string, INodeCleaningSpeedStats>()
  if (!nodeIds.length) return stats
  if (client.status !== 'ready') throw new Error('监控 Redis 未就绪')
  const day = metricsWindow(now).today
  const tx = client.multi()
  for (const nodeId of nodeIds) tx.hgetall(nodeCleaningMetricsKey(nodeId, day))
  const result = await tx.exec()
  if (!result || result.some(([error]) => error)) throw new Error('节点清洗速度读取失败')
  nodeIds.forEach((nodeId, index) => {
    const row = result[index][1] as Record<string, string>
    const samples = Number(row.samples || 0)
    const events = Number(row.events || 0)
    const durationMs = Number(row.durationMs || 0)
    stats.set(nodeId, {
      avg: samples > 0 && durationMs > 0 ? events * 1000 / durationMs : null,
      max: row.maxSpeed !== undefined ? Number(row.maxSpeed) : null,
      min: row.minSpeed !== undefined ? Number(row.minSpeed) : null,
    })
  })
  return stats
}
