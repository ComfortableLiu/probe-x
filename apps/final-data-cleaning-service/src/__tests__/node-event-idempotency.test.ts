/**
 * 清洗落库事件级幂等测试
 *
 * 背景：final_event_log 与 event_attribution 双表 Promise.all 落库不具备原子性，
 * 一成一败后调度器会以新 task_id（:rN）重试，任务级幂等键拦截不到，
 * MergeTree 表又无唯一约束，会产生重复数据。
 *
 * 修复：executeTask 落库前按 (date, session_id) 查出两张表已存在的事件 id，
 * 过滤后再插入。本文件模拟各种「部分已落库」状态下的重试执行，验证不产生重复数据。
 */

import { Subject } from 'rxjs'
import { ComputeNodeService, ProgressUpdate } from '../service/node.service'
import { MockClickHouseService } from './mocks/clickhouse.service.mock'
import {
  resetEventCounter,
  createMultiPageNavigationScenario,
} from './fixtures/event-factory'

// 与 MockClickHouseService 中 event_log 的日期匹配逻辑保持一致：
// Date 对象转 ISO 字符串后按前缀比较 toDate(...) = queryDate
function matchesQueryDate(value: unknown, queryDate?: string): boolean {
  if (!queryDate) return true
  const str = value instanceof Date ? value.toISOString() : String(value)
  return str.startsWith(queryDate)
}

/**
 * 在 MockClickHouseService 基础上补充两张结果表的存在性查询，
 * 数据来自同一份内存表，模拟「前一次执行已部分落库」的状态
 */
class IdempotencyMockClickHouseService extends MockClickHouseService {
  async query<T = any>(sql: string, params?: Record<string, any>): Promise<T[]> {
    const { queryDate, sessionId } = params || {}

    if (sql.includes('final_event_log')) {
      this.queryLog.push({ sql, params })
      return this.data.final_event_log
        .filter(row => matchesQueryDate(row.$service_time, queryDate)
          && (!sessionId || row.$session_id === sessionId))
        .map(row => ({ $event_id: row.$event_id })) as T[]
    }

    if (sql.includes('event_attribution')) {
      this.queryLog.push({ sql, params })
      const eventIds = this.data.event_attribution
        .filter(row => matchesQueryDate(row.event_time, queryDate)
          && (!sessionId || row.session_id === sessionId))
        .map(row => row.event_id)
      // DISTINCT event_id
      return [...new Set(eventIds)].map(event_id => ({ event_id })) as T[]
    }

    return super.query(sql, params)
  }
}

describe('清洗落库事件级幂等（重试不产生重复数据）', () => {
  const date = '2026-06-01'
  let service: ComputeNodeService
  let mockCH: IdempotencyMockClickHouseService

  beforeEach(() => {
    resetEventCounter()
    mockCH = new IdempotencyMockClickHouseService()
    service = new ComputeNodeService(mockCH as any)
  })

  /**
   * 通过 executeTask 真实路径执行任务（不传 RedisService，任务级去重自动跳过，
   * 等价于调度器以新 task_id 重试的场景），返回收到的全部进度帧
   */
  async function runTask(taskId: string, sessionId: string): Promise<ProgressUpdate[]> {
    const progress: ProgressUpdate[] = []
    const subject = new Subject<ProgressUpdate>()
    subject.subscribe(p => progress.push(p))
    await service.executeTask({ task_id: taskId, session_id: sessionId, date }, subject)
    return progress
  }

  it('final_event_log 已含部分事件时重试：只插入缺失的事件，不重复插入已存在的事件', async () => {
    const sessionId = 'session-retry-partial'
    const events = createMultiPageNavigationScenario(sessionId)
    mockCH.seedEventLog(events)

    // 模拟前一次执行：final_event_log 写入了前 3 条事件后失败
    mockCH.data.final_event_log.push(...events.slice(0, 3))

    const progress = await runTask('task-partial:r1', sessionId)

    const last = progress[progress.length - 1]
    expect(last.completed).toBe(true)
    expect(last.failed).toBe(false)

    // final_event_log 的 insert 只包含后 4 条新事件
    const finalInsert = mockCH.insertLog.find(log => log.table === 'final_event_log')
    expect(finalInsert).toBeDefined()
    expect(finalInsert!.data).toHaveLength(4)
    const insertedIds = finalInsert!.data.map((e: any) => e.$event_id)
    events.slice(0, 3).forEach(e => expect(insertedIds).not.toContain(e.$event_id))
    events.slice(3).forEach(e => expect(insertedIds).toContain(e.$event_id))

    // event_attribution 此前未写入，应全量插入 2 条 KV 行
    const attrInsert = mockCH.insertLog.find(log => log.table === 'event_attribution')
    expect(attrInsert).toBeDefined()
    expect(attrInsert!.data).toHaveLength(2)

    // 表内最终数据无重复
    const finalTable = mockCH.getTableData('final_event_log')
    expect(finalTable).toHaveLength(events.length)
    expect(new Set(finalTable.map((e: any) => e.$event_id)).size).toBe(events.length)
  })

  it('final_event_log 已全量写入而 event_attribution 未写入时重试：跳过 final_event_log 插入，只补归因数据', async () => {
    const sessionId = 'session-retry-attr-missing'
    const events = createMultiPageNavigationScenario(sessionId)
    mockCH.seedEventLog(events)

    // 模拟前一次执行：final_event_log 全部写入成功，event_attribution 写入失败
    mockCH.data.final_event_log.push(...events)

    const progress = await runTask('task-attr-missing:r1', sessionId)

    const last = progress[progress.length - 1]
    expect(last.completed).toBe(true)
    expect(last.failed).toBe(false)

    // final_event_log 过滤后为空，不应再调用 insert
    expect(mockCH.insertLog.filter(log => log.table === 'final_event_log')).toHaveLength(0)

    // event_attribution 全量插入 2 条 KV 行
    const attrInsert = mockCH.insertLog.find(log => log.table === 'event_attribution')
    expect(attrInsert).toBeDefined()
    expect(attrInsert!.data).toHaveLength(2)

    const finalTable = mockCH.getTableData('final_event_log')
    expect(finalTable).toHaveLength(events.length)
    expect(new Set(finalTable.map((e: any) => e.$event_id)).size).toBe(events.length)
  })

  it('event_attribution 已含该事件 KV 时重试：attribution 按 event_id 过滤', async () => {
    const sessionId = 'session-retry-attr-exists'
    const events = createMultiPageNavigationScenario(sessionId)
    mockCH.seedEventLog(events)

    // 模拟前一次执行：event_attribution 已写入详情页归因事件的 KV，final_event_log 未写入
    const detailEvent = events.find(
      e => e.$is_attribution_event && e.$target_page_id === 'page-product-detail',
    )!
    mockCH.data.event_attribution.push(
      { event_id: detailEvent.$event_id, session_id: sessionId, attr_key: '$productId', attr_value: 'prod-001', event_time: detailEvent.$service_time },
      { event_id: detailEvent.$event_id, session_id: sessionId, attr_key: '$productName', attr_value: 'iPhone 15 Pro', event_time: detailEvent.$service_time },
    )

    const progress = await runTask('task-attr-exists:r1', sessionId)

    const last = progress[progress.length - 1]
    expect(last.completed).toBe(true)
    expect(last.failed).toBe(false)

    // 该事件的全部归因 KV 已存在，event_attribution 过滤后为空，不应再调用 insert
    expect(mockCH.insertLog.filter(log => log.table === 'event_attribution')).toHaveLength(0)
    expect(mockCH.getTableData('event_attribution')).toHaveLength(2)

    // final_event_log 无历史数据，应全量插入
    const finalInsert = mockCH.insertLog.find(log => log.table === 'final_event_log')
    expect(finalInsert).toBeDefined()
    expect(finalInsert!.data).toHaveLength(events.length)
  })

  it('两张表数据均已完整时重试：两次 insert 都跳过，表数据保持不变', async () => {
    const sessionId = 'session-retry-complete'
    const events = createMultiPageNavigationScenario(sessionId)
    mockCH.seedEventLog(events)

    // 模拟前一次执行已完整落库
    mockCH.data.final_event_log.push(...events)
    const detailEvent = events.find(
      e => e.$is_attribution_event && e.$target_page_id === 'page-product-detail',
    )!
    mockCH.data.event_attribution.push(
      { event_id: detailEvent.$event_id, session_id: sessionId, attr_key: '$productId', attr_value: 'prod-001', event_time: detailEvent.$service_time },
      { event_id: detailEvent.$event_id, session_id: sessionId, attr_key: '$productName', attr_value: 'iPhone 15 Pro', event_time: detailEvent.$service_time },
    )

    const progress = await runTask('task-complete:r1', sessionId)

    const last = progress[progress.length - 1]
    expect(last.completed).toBe(true)
    expect(last.failed).toBe(false)

    expect(mockCH.insertLog).toHaveLength(0)
    expect(mockCH.getTableData('final_event_log')).toHaveLength(events.length)
    expect(mockCH.getTableData('event_attribution')).toHaveLength(2)
  })

  it('首次执行（无历史数据）：全量插入，不受幂等过滤影响', async () => {
    const sessionId = 'session-first-run'
    const events = createMultiPageNavigationScenario(sessionId)
    mockCH.seedEventLog(events)

    const progress = await runTask('task-first-run', sessionId)

    const last = progress[progress.length - 1]
    expect(last.completed).toBe(true)
    expect(last.failed).toBe(false)

    const finalInsert = mockCH.insertLog.find(log => log.table === 'final_event_log')
    const attrInsert = mockCH.insertLog.find(log => log.table === 'event_attribution')
    expect(finalInsert!.data).toHaveLength(events.length)
    expect(attrInsert!.data).toHaveLength(2)
  })
})
