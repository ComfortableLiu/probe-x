import { randomUUID } from 'node:crypto'
import type { Redis } from 'ioredis'
import type { IComputeNodeLogsQuery, IComputeNodeLogsRes, NodeLogEntry, NodeLogFilter } from '@probe-x/shared-types/src'

/** 每个节点保留的最近日志条数上限 */
export const NODE_LOGS_MAX_ENTRIES = 2000
/** 单页大小；分页不能扩大 Redis 的日志留存范围 */
export const NODE_LOGS_DEFAULT_PAGE_SIZE = 100
export const NODE_LOGS_MAX_PAGE_SIZE = 200
/** 节点日志留存时长：3 天 */
export const NODE_LOGS_TTL_SECONDS = 3 * 86400

export const nodeLogsKey = (nodeId: string) => `probe-x:compute-node:logs:${nodeId}`

/** 无有效 hash tag 的旧 key 使用全 key 的 CRC16/XMODEM 槽位。 */
function wholeKeySlot(key: string): number {
  let crc = 0
  for (const byte of Buffer.from(key)) {
    crc ^= byte << 8
    for (let bit = 0; bit < 8; bit++) crc = (crc << 1) ^ ((crc & 0x8000) ? 0x1021 : 0)
    crc &= 0xffff
  }
  return crc & 0x3fff
}

// 仅含特殊花括号的旧 nodeId 需要槽位别名；缓存按槽位有界（最多 16384 项）。
const slotTags: Array<string | undefined> = []
let nextSlotTag = 0

export const nodeLogsMetaKey = (nodeId: string): string => {
  const key = nodeLogsKey(nodeId)
  const open = key.indexOf('{')
  const close = key.indexOf('}', open + 1)
  // Redis 只认第一个 {...} 且内容必须非空；保留旧 key，使升级后历史仍可读。
  if (open >= 0 && close > open + 1) return `${key}:meta`
  if (!key.includes('}')) return `{${key}}:meta`
  // 空 {} 或孤立 } 不能直接包裹 key，需找到同槽的安全 ASCII hash tag。
  const slot = wholeKeySlot(key)
  while (slotTags[slot] === undefined) {
    const candidate = String(nextSlotTag++)
    const candidateSlot = wholeKeySlot(candidate)
    slotTags[candidateSlot] ??= candidate
  }
  return `{${slotTags[slot]}}:${key}:meta`
}

/** 列表与序号在同一个 Lua 操作内读写；首次访问旧列表时补齐序号元数据。 */
const LOG_METADATA = `
local length = redis.call('LLEN', KEYS[1])
local metadata = redis.call('HMGET', KEYS[2], 'epoch', 'tail')
local epoch = metadata[1]
local tail = tonumber(metadata[2])
if length == 0 or not epoch or not tail or tail < length then
  epoch = ARGV[1]
  tail = length
  if length > 0 then
    redis.call('HSET', KEYS[2], 'epoch', epoch, 'tail', tail)
    local ttl = redis.call('PTTL', KEYS[1])
    if ttl > 0 then
      redis.call('PEXPIRE', KEYS[2], ttl)
    else
      redis.call('EXPIRE', KEYS[1], ARGV[2])
      redis.call('EXPIRE', KEYS[2], ARGV[2])
    end
  end
end
`

const APPEND_NODE_LOGS = `-- probe-x:append-node-logs-v2
${LOG_METADATA}
-- 逐条写入，不用 unpack；大批日志不能再次触发参数栈上限。
for index = 4, #ARGV do
  redis.call('RPUSH', KEYS[1], ARGV[index])
  tail = tail + 1
end
redis.call('LTRIM', KEYS[1], -tonumber(ARGV[3]), -1)
redis.call('HSET', KEYS[2], 'epoch', epoch, 'tail', tail)
redis.call('EXPIRE', KEYS[1], ARGV[2])
redis.call('EXPIRE', KEYS[2], ARGV[2])
return 1
`

const READ_NODE_LOG_PAGE = `-- probe-x:read-node-log-page-v2
${LOG_METADATA}
local cursorEpoch = ARGV[3]
local before = tonumber(ARGV[4])
local limit = tonumber(ARGV[5])
local level = ARGV[6]
local head = tail - length + 1
if cursorEpoch ~= '' and (length == 0 or cursorEpoch ~= epoch or before <= head or before > tail + 1) then
  return {'reset', epoch}
end
local offset = length - 1
if cursorEpoch ~= '' then
  offset = before - head - 1
end
local result = {'ok', epoch, tostring(tail + 1)}
local matched = 0
-- 仅在 Redis 内部扫描有界留存列表，找到 limit + 1 条即停止；
-- 每批至多 128 条，返回到服务进程的日志始终只有一页和一条探测记录。
while offset >= 0 and matched <= limit do
  local start = math.max(0, offset - 127)
  local batch = redis.call('LRANGE', KEYS[1], start, offset)
  for index = #batch, 1, -1 do
    local ok, entry = pcall(cjson.decode, batch[index])
    if ok and type(entry) == 'table' and type(entry.ts) == 'number' and entry.ts == entry.ts and math.abs(entry.ts) < math.huge and type(entry.message) == 'string' then
      local knownLevel = entry.level == 'log' or entry.level == 'info' or entry.level == 'warn' or entry.level == 'error' or entry.level == 'debug'
      local matches = level == 'all' or entry.level == level or (level == 'log' and entry.level == 'info')
      if knownLevel and matches then
        table.insert(result, batch[index])
        table.insert(result, tostring(head + start + index - 1))
        matched = matched + 1
        if matched > limit then break end
      end
    end
  end
  offset = start - 1
end
return result
`

interface NodeLogCursor {
  version: 1
  nodeId: string
  level: NodeLogFilter
  epoch: string
  before: number
}

export class InvalidNodeLogQueryError extends Error {}

const encodeCursor = (cursor: NodeLogCursor): string =>
  Buffer.from(JSON.stringify(cursor)).toString('base64url')

function parseQuery(nodeId: string, query: IComputeNodeLogsQuery) {
  const limit = query.limit ?? NODE_LOGS_DEFAULT_PAGE_SIZE
  const level = query.level ?? 'all'
  if (!nodeId || !Number.isSafeInteger(limit) || limit < 1 || limit > NODE_LOGS_MAX_PAGE_SIZE) {
    throw new InvalidNodeLogQueryError(`日志页大小必须为 1–${NODE_LOGS_MAX_PAGE_SIZE} 的整数`)
  }
  if (!['all', 'log', 'warn', 'error', 'debug'].includes(level)) {
    throw new InvalidNodeLogQueryError('日志级别无效')
  }
  let cursor: NodeLogCursor | undefined
  if (query.cursor !== undefined) {
    try {
      if (typeof query.cursor !== 'string' || query.cursor.length > 2048 || !/^[A-Za-z0-9_-]+$/.test(query.cursor)) {
        throw new Error('invalid encoding')
      }
      const decoded = Buffer.from(query.cursor, 'base64url')
      if (decoded.toString('base64url') !== query.cursor) throw new Error('invalid encoding')
      cursor = JSON.parse(decoded.toString('utf8')) as NodeLogCursor
      if (!cursor || cursor.version !== 1 || cursor.nodeId !== nodeId || cursor.level !== level
        || typeof cursor.epoch !== 'string' || !/^[a-f0-9-]{36}$/.test(cursor.epoch)
        || !Number.isSafeInteger(cursor.before) || cursor.before < 1) {
        throw new Error('invalid cursor')
      }
    } catch {
      throw new InvalidNodeLogQueryError('日志游标无效，请重新加载最新日志')
    }
  }
  return { limit, level, cursor }
}

/**
 * 追加日志并原子推进尾部序号；裁剪后保留原序号，TTL 后使用新的留存周期标识。
 * Redis 未就绪时快速失败，由上报调用方隔离遥测错误，不影响清洗链路。
 */
export async function appendNodeLogs(client: Redis, nodeId: string, entries: NodeLogEntry[]): Promise<void> {
  if (!nodeId || !entries.length) return
  if (client.status !== 'ready') throw new Error('监控 Redis 未就绪')
  // 单次节点上报最多 200 条；即使调用端超量，也分批执行，避免可变参数爆栈。
  for (let start = 0; start < entries.length; start += NODE_LOGS_MAX_PAGE_SIZE) {
    const batch = entries.slice(start, start + NODE_LOGS_MAX_PAGE_SIZE).map(entry => JSON.stringify(entry))
    const result = await client.eval(
      APPEND_NODE_LOGS,
      2,
      nodeLogsKey(nodeId),
      nodeLogsMetaKey(nodeId),
      randomUUID(),
      String(NODE_LOGS_TTL_SECONDS),
      String(NODE_LOGS_MAX_ENTRIES),
      ...batch,
    )
    if (result !== 1) throw new Error('节点日志写入失败')
  }
}

/**
 * 查询最新/更早的一页，先筛选级别再分页。游标按日志序号定位，
 * 新日志追加和 LTRIM 不会造成 offset 分页的重复或跳行。
 */
export async function readNodeLogPage(
  client: Redis,
  nodeId: string,
  query: IComputeNodeLogsQuery = {},
): Promise<IComputeNodeLogsRes> {
  const { limit, level, cursor } = parseQuery(nodeId, query)
  if (client.status !== 'ready') throw new Error('监控 Redis 未就绪')
  const result = await client.eval(
    READ_NODE_LOG_PAGE,
    2,
    nodeLogsKey(nodeId),
    nodeLogsMetaKey(nodeId),
    randomUUID(),
    String(NODE_LOGS_TTL_SECONDS),
    cursor?.epoch ?? '',
    cursor ? String(cursor.before) : '',
    String(limit),
    level,
  )
  if (!Array.isArray(result) || result.length < 2 || !['ok', 'reset'].includes(result[0]) || typeof result[1] !== 'string') {
    throw new Error('节点日志读取失败')
  }
  const response: IComputeNodeLogsRes = {
    nodeId,
    entries: [],
    pageCursor: null,
    nextCursor: null,
    hasMore: false,
    retentionLimit: NODE_LOGS_MAX_ENTRIES,
  }
  if (result[0] === 'reset') return { ...response, resetRequired: true }
  if (result.length < 3 || (result.length - 3) % 2 !== 0) throw new Error('节点日志读取失败')
  const epoch = result[1]
  response.hasMore = (result.length - 3) / 2 > limit
  let oldestSequence = 0
  for (let index = 3; index < Math.min(result.length, 3 + limit * 2); index += 2) {
    const sequence = Number(result[index + 1])
    if (!Number.isSafeInteger(sequence) || sequence < 1) throw new Error('节点日志读取失败')
    const entry = JSON.parse(result[index]) as NodeLogEntry
    response.entries.push({ ...entry, id: `${epoch}:${sequence}` })
    oldestSequence = sequence
  }
  response.entries.reverse()
  if (response.entries.length) {
    response.pageCursor = query.cursor ?? encodeCursor({ version: 1, nodeId, level, epoch, before: Number(result[2]) })
  }
  if (response.hasMore) {
    response.nextCursor = encodeCursor({ version: 1, nodeId, level, epoch, before: oldestSequence })
  }
  return response
}

/** 兼容旧调用：仅读取最近 limit 条，分页 API 使用 readNodeLogPage。 */
export async function readNodeLogs(client: Redis, nodeId: string, limit: number): Promise<NodeLogEntry[]> {
  if (!nodeId || limit <= 0) return []
  if (client.status !== 'ready') throw new Error('监控 Redis 未就绪')
  const raw = await client.lrange(nodeLogsKey(nodeId), -limit, -1)
  const entries: NodeLogEntry[] = []
  for (const item of raw) {
    try {
      const entry = JSON.parse(item) as NodeLogEntry
      if (typeof entry?.ts === 'number' && typeof entry?.message === 'string') entries.push(entry)
    } catch {
      // 单条脏数据不影响整批读取
    }
  }
  return entries
}
