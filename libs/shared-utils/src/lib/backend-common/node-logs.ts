import type { Redis } from 'ioredis'
import type { NodeLogEntry } from '@probe-x/shared-types/src'

/** 每个节点保留的最近日志条数上限 */
export const NODE_LOGS_MAX_ENTRIES = 2000
/** 节点日志留存时长：3 天 */
export const NODE_LOGS_TTL_SECONDS = 3 * 86400

export const nodeLogsKey = (nodeId: string) => `probe-x:compute-node:logs:${nodeId}`

/**
 * 追加一批节点日志到 Redis 有界列表（按时间序，尾部最新）。
 *
 * 与 runtime-metrics 同约定：Redis 未就绪时快速失败，由调用方兜底，
 * 遥测失败不能反过来影响业务链路。
 */
export async function appendNodeLogs(
  client: Redis,
  nodeId: string,
  entries: NodeLogEntry[],
): Promise<void> {
  if (!nodeId || !entries.length) return
  if (client.status !== 'ready') throw new Error('监控 Redis 未就绪')
  const key = nodeLogsKey(nodeId)
  const result = await client.multi()
    .rpush(key, ...entries.map((entry) => JSON.stringify(entry)))
    .ltrim(key, -NODE_LOGS_MAX_ENTRIES, -1)
    .expire(key, NODE_LOGS_TTL_SECONDS)
    .exec()
  if (!result || result.some(([error]) => error)) throw new Error('节点日志写入失败')
}

/** 读取节点最近 limit 条日志（按时间升序返回，尾部最新）；无记录返回空数组 */
export async function readNodeLogs(
  client: Redis,
  nodeId: string,
  limit: number,
): Promise<NodeLogEntry[]> {
  if (!nodeId || limit <= 0) return []
  if (client.status !== 'ready') throw new Error('监控 Redis 未就绪')
  const raw = await client.lrange(nodeLogsKey(nodeId), -limit, -1)
  const entries: NodeLogEntry[] = []
  for (const item of raw) {
    try {
      const entry = JSON.parse(item) as NodeLogEntry
      if (typeof entry?.ts === 'number' && typeof entry?.message === 'string') {
        entries.push(entry)
      }
    } catch {
      // 单条脏数据不影响整批读取
    }
  }
  return entries
}
