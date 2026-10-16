import { TupleParam } from '@clickhouse/client'
import type { ClickHouseService } from '@probe-x/shared-utils/src/lib/backend-common'
import type { Redis } from 'ioredis'

export interface BacklogRow {
  session_id: string
  date: string
  required_runtime?: 'rust'
}

export interface BacklogCursor {
  serviceTime: string
  sessionId: string
  eventName: string
}

export interface BacklogRange {
  runDate: string
  throughDate: string
  targetDate?: string
}

export interface BacklogPage {
  rows: BacklogRow[]
  nextCursor: BacklogCursor | null
  done: boolean
}

interface SourceRow extends BacklogRow {
  service_time: string
  event_name: string
}

const QUERY_LIMITS = {
  max_threads: 2,
  max_memory_usage: 256 * 1024 * 1024,
  max_execution_time: 30,
  result_overflow_mode: 'throw' as const,
}

function sliceKey(row: BacklogRow): string {
  return JSON.stringify([row.date, row.session_id])
}

/** 分页游标只有在 Rust 未完成标记读取成功后才可前进；不能把部分落库误认为完成。 */
export async function readRustIncompleteSlices(client: Redis, candidates: BacklogRow[]): Promise<Set<string>> {
  if (client.status !== 'ready') throw new Error('Rust 清洗完成状态暂不可用，请稍后重试')
  const byDate = new Map<string, BacklogRow[]>()
  for (const row of candidates) {
    const rows = byDate.get(row.date) || []
    rows.push(row)
    byDate.set(row.date, rows)
  }
  const incomplete = new Set<string>()
  for (const [date, rows] of byDate) {
    // 每个 pipeline 仅使用一个 Redis key，兼容 Redis Cluster 槽位路由。
    const pipeline = client.pipeline()
    for (const row of rows) pipeline.sismember(`probe-x:rust-clean:incomplete:${date}`, row.session_id)
    const results = await pipeline.exec()
    if (!results || results.length !== rows.length || results.some(([error, value]) => error || (value !== 0 && value !== 1))) {
      throw new Error('Rust 清洗完成状态读取失败，请稍后重试')
    }
    for (let index = 0; index < rows.length; index += 1) {
      if (results[index][1] === 1) incomplete.add(sliceKey(rows[index]))
    }
  }
  return incomplete
}

/**
 * 按原表物理排序键读取一页事件键，随后只查重本页涉及的会话切片。
 * 游标用于发现切片，不用于读取待计算事件：相同排序键的行必属同一切片，
 * 因而即使分页落在这些重复键之间，也可安全跳过余下同键行。
 */
export async function readCleaningBacklogPage(
  clickhouse: ClickHouseService,
  range: BacklogRange,
  cursor: BacklogCursor | null,
  limit: number,
  signal?: AbortSignal,
  readIncomplete?: (candidates: BacklogRow[]) => Promise<Set<string>>,
): Promise<BacklogPage> {
  if (!Number.isInteger(limit) || limit < 1) throw new RangeError('清洗分片读取数量必须为正整数')

  const sourceRows = await clickhouse.query<SourceRow>(`
    SELECT
      toString(\`$service_time\`) AS service_time,
      \`$session_id\` AS session_id,
      toString(\`$event_name\`) AS event_name,
      toString(toDate(\`$service_time\`)) AS date
    FROM event_log
    PREWHERE \`$service_time\` < toDateTime64({throughDate:String}, 3) + INTERVAL 1 DAY
      ${range.targetDate ? `AND \`$service_time\` >= toDateTime64({targetDate:String}, 3)
      AND \`$service_time\` < toDateTime64({targetDate:String}, 3) + INTERVAL 1 DAY` : ''}
    ${cursor ? `WHERE (\`$service_time\`, \`$session_id\`, \`$event_name\`) >
      (toDateTime64({afterTime:String}, 3), {afterSession:String}, {afterEvent:String})` : ''}
    ORDER BY \`$service_time\`, \`$session_id\`, \`$event_name\`
    LIMIT {pageSize:UInt32}
  `, {
    throughDate: range.throughDate,
    ...(range.targetDate ? { targetDate: range.targetDate } : {}),
    ...(cursor ? {
      afterTime: cursor.serviceTime,
      afterSession: cursor.sessionId,
      afterEvent: cursor.eventName,
    } : {}),
    pageSize: limit,
  }, {
    ...QUERY_LIMITS,
    optimize_read_in_order: 1,
    max_result_rows: limit,
  }, signal)

  signal?.throwIfAborted()

  if (sourceRows.length === 0) return { rows: [], nextCursor: null, done: true }

  const last = sourceRows[sourceRows.length - 1]
  // 原表是 DateTime64(3)，toString 保留毫秒且按 ClickHouse 表时区输出。
  // 直接回传给同一服务端的 toDateTime64，避免 JS Date 重新解释时区或丢失毫秒。
  const nextCursor = {
    serviceTime: last.service_time,
    sessionId: last.session_id,
    eventName: last.event_name,
  }
  const candidates = new Map<string, BacklogRow>()
  let firstDate = sourceRows[0].date
  let lastDate = firstDate
  for (const row of sourceRows) {
    candidates.set(sliceKey(row), { date: row.date, session_id: row.session_id })
    if (row.date < firstDate) firstDate = row.date
    if (row.date > lastDate) lastDate = row.date
  }

  // 不构造全历史 NOT IN 集合：服务端去重集合及返回结果均受本页候选数量约束。
  const completed = await clickhouse.query<BacklogRow>(`
    SELECT DISTINCT \`$session_id\` AS session_id, toString(toDate(\`$service_time\`)) AS date
    FROM final_event_log
    PREWHERE \`$service_time\` >= toDateTime64({firstDate:String}, 3)
      AND \`$service_time\` < toDateTime64({lastDate:String}, 3) + INTERVAL 1 DAY
    WHERE (toDate(\`$service_time\`), \`$session_id\`) IN {candidateSlices:Array(Tuple(Date,String))}
    LIMIT {candidateCount:UInt32}
  `, {
    firstDate,
    lastDate,
    candidateSlices: Array.from(candidates.values(), row => new TupleParam([row.date, row.session_id])),
    candidateCount: candidates.size,
  }, {
    ...QUERY_LIMITS,
    max_result_rows: candidates.size,
    max_rows_in_set: candidates.size,
    set_overflow_mode: 'throw',
  }, signal)

  const completedKeys = new Set(completed.map(sliceKey))
  const incompleteKeys = readIncomplete ? await readIncomplete([...candidates.values()]) : new Set<string>()
  signal?.throwIfAborted()
  return {
    rows: Array.from(candidates.values())
      .filter(row => !completedKeys.has(sliceKey(row)) || incompleteKeys.has(sliceKey(row)))
      .map(row => incompleteKeys.has(sliceKey(row)) ? { ...row, required_runtime: 'rust' as const } : row),
    nextCursor,
    done: sourceRows.length < limit,
  }
}
