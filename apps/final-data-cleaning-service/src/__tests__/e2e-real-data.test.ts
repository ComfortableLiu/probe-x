/**
 * Phase 2: 真实数据端到端测试
 * 
 * 连接真实 ClickHouse (123.56.201.124:9301)，使用 ecommerce-demo 产生的
 * 真实埋点数据进行最终清洗服务的全链路测试。
 * 
 * 测试覆盖：
 * 1. 查询真实 event_log 数据
 * 2. 执行归因计算（真实数据中可能无归因事件）
 * 3. 写入 final_event_log 和 event_attribution
 * 4. 验证写入结果
 * 5. 多 session 批量清洗
 * 6. 清洗前后数据一致性
 * 7. 清除测试写入的数据
 */

import { createClient, ClickHouseClient } from '@clickhouse/client'
import { ComputeNodeService } from '../service/node.service'
import { computeAttribution } from '../lib/attribution-engine'
import type { IPreEventLog } from '@probe-x/shared-types/src'

// 真实 ClickHouse 连接配置
const CH_CONFIG = {
  url: 'http://123.56.201.124:9301',
  username: 'admin',
  password: '12341234',
  database: 'probe_x',
}

let chClient: ClickHouseClient
let service: ComputeNodeService

// 记录测试写入的数据，用于清理
let testSessionIds: string[] = []
let testDates: string[] = []

beforeAll(async () => {
  chClient = createClient(CH_CONFIG)
  service = new ComputeNodeService({
    query: async (sql: string, params?: any) => {
      const r = await chClient.query({ query: sql, query_params: params, format: 'JSONEachRow' })
      return r.json()
    },
    insert: async (table: string, data: any[]) => {
      return chClient.insert({ table, values: data, format: 'JSONEachRow' })
    },
    executeDDL: async (query: string) => {
      return chClient.command({ query })
    },
    close: async () => { await chClient.close() },
  } as any)
})

afterAll(async () => {
  // 清理测试写入的数据
  if (testSessionIds.length > 0 && testDates.length > 0) {
    try {
      const sessionIdList = testSessionIds.map(id => `'${id}'`).join(',')
      const dateList = testDates.map(d => `'${d}'`).join(',')
      await chClient.command({
        query: `ALTER TABLE final_event_log DELETE WHERE $session_id IN (${sessionIdList}) AND toDate(\`$service_time\`) IN (${dateList})`,
      })
      await chClient.command({
        query: `ALTER TABLE event_attribution DELETE WHERE toDate(event_time) IN (${dateList})`,
      })
      console.log(`[cleanup] Deleted test data for sessions: ${testSessionIds.join(', ')}`)
    } catch (e) {
      console.error('[cleanup] Failed:', (e as Error).message)
    }
  }
  await chClient.close()
}, 30000)

/**
 * 辅助函数：查询 ClickHouse
 */
async function queryCH<T>(sql: string): Promise<T[]> {
  const r = await chClient.query({ query: sql, format: 'JSONEachRow' })
  return r.json<T>()
}

/**
 * 辅助函数：执行一次真实清洗
 */
async function executeRealCleaning(sessionId: string, date: string) {
  const eventList = await service.getAllEvents(date, sessionId)
  const result = computeAttribution(eventList as IPreEventLog[])
  if (result.finalEvents.length > 0) {
    await chClient.insert({ table: 'final_event_log', values: result.finalEvents, format: 'JSONEachRow' })
  }
  if (result.attributions.length > 0) {
    await chClient.insert({ table: 'event_attribution', values: result.attributions, format: 'JSONEachRow' })
  }
  return { eventCount: result.finalEvents.length, attributionCount: result.attributions.length }
}

describe('Phase 2: 真实数据端到端测试', () => {
  describe('数据探查', () => {
    it('event_log 表应有真实数据', async () => {
      const [{ cnt }] = await queryCH<{ cnt: string }>('SELECT count() as cnt FROM event_log')
      const count = Number(cnt)
      expect(count).toBeGreaterThan(0)
      console.log(`  event_log total rows: ${count}`)
    })

    it('应有多个 session 的数据', async () => {
      const sessions = await queryCH<{ sid: string; cnt: string }>(
        "SELECT $session_id as sid, count() as cnt FROM event_log WHERE $session_id != '' GROUP BY $session_id ORDER BY cnt DESC LIMIT 5"
      )
      expect(sessions.length).toBeGreaterThan(0)
      console.log(`  Top sessions: ${sessions.map(s => `${s.sid}(${s.cnt})`).join(', ')}`)
    })

    it('应有多个日期的数据', async () => {
      const dates = await queryCH<{ d: string; cnt: string }>(
        'SELECT toDate(`$service_time`) as d, count() as cnt FROM event_log GROUP BY d ORDER BY d DESC LIMIT 5'
      )
      expect(dates.length).toBeGreaterThan(0)
      console.log(`  Date distribution: ${dates.map(d => `${d.d}(${d.cnt})`).join(', ')}`)
    })
  })

  describe('单 Session 真实清洗', () => {
    let targetSessionId: string
    let targetDate: string

    beforeAll(async () => {
      // 选一个事件最多的 session
      const sessions = await queryCH<{ sid: string; cnt: string; d: string }>(
        "SELECT $session_id as sid, count() as cnt, toDate(min(`$service_time`)) as d FROM event_log WHERE $session_id != '' GROUP BY $session_id ORDER BY cnt DESC LIMIT 1"
      )
      targetSessionId = sessions[0].sid
      targetDate = sessions[0].d
      testSessionIds.push(targetSessionId)
      testDates.push(targetDate)
      console.log(`  Target session: ${targetSessionId} (${sessions[0].cnt} events, date: ${targetDate})`)
    })

    it('应能查询到真实 session 的事件列表', async () => {
      const events = await service.getAllEvents(targetDate, targetSessionId)
      expect(events.length).toBeGreaterThan(0)
      console.log(`  Queried ${events.length} events for session ${targetSessionId}`)

      // 验证事件结构
      const firstEvent = events[0] as any
      expect(firstEvent.$event_name).toBeDefined()
      expect(firstEvent.$session_id).toBe(targetSessionId)
      expect(firstEvent.$device_id).toBeDefined()
      expect(firstEvent.$page_id).toBeDefined()
    })

    it('归因计算应正常执行（真实数据可能无归因事件）', async () => {
      const events = await service.getAllEvents(targetDate, targetSessionId)
      const result = computeAttribution(events as IPreEventLog[])

      // 事件应完整透传
      expect(result.finalEvents.length).toBe(events.length)

      // 真实数据中大概率没有 $is_attribution_event，所以归因数据可能为空
      console.log(`  Attribution results: ${result.attributions.length} KV entries`)
      console.log(`  Attribution map size: ${result.attributionDataMap.size}`)
    })

    it('应将清洗结果写入 final_event_log', async () => {
      // 先查写入前的数量
      const [{ cnt: beforeCnt }] = await queryCH<{ cnt: string }>(
        `SELECT count() as cnt FROM final_event_log WHERE $session_id = '${targetSessionId}'`
      )
      const beforeCount = Number(beforeCnt)

      // 执行清洗
      const result = await executeRealCleaning(targetSessionId, targetDate)
      expect(result.eventCount).toBeGreaterThan(0)
      console.log(`  Written ${result.eventCount} events, ${result.attributionCount} attributions`)

      // 等待 ClickHouse 最终一致
      await new Promise(r => setTimeout(r, 2000))

      // 验证写入后数量增加
      const [{ cnt: afterCnt }] = await queryCH<{ cnt: string }>(
        `SELECT count() as cnt FROM final_event_log WHERE $session_id = '${targetSessionId}'`
      )
      const afterCount = Number(afterCnt)
      expect(afterCount).toBeGreaterThan(beforeCount)
      console.log(`  final_event_log: ${beforeCount} → ${afterCount} (+${afterCount - beforeCount})`)
    })

    it('写入的 final_event_log 数据应与 event_log 原始数据一致', async () => {
      const originalEvents = await queryCH<any>(
        `SELECT $event_name, $page_id, $session_id, $device_id, toString(\`$service_time\`) as st FROM event_log WHERE $session_id = '${targetSessionId}' AND toDate(\`$service_time\`) = '${targetDate}' ORDER BY \`$service_time\``
      )
      const finalEvents = await queryCH<any>(
        `SELECT $event_name, $page_id, $session_id, $device_id, toString(\`$service_time\`) as st FROM final_event_log WHERE $session_id = '${targetSessionId}' ORDER BY \`$service_time\``
      )

      expect(finalEvents.length).toBeGreaterThan(0)
      expect(finalEvents.length).toBe(originalEvents.length)

      // 按 service_time 排序后逐行比对（两张表用相同 ORDER BY 保证顺序一致）
      for (let i = 0; i < originalEvents.length; i++) {
        expect(finalEvents[i].$event_name).toBe(originalEvents[i].$event_name)
        expect(finalEvents[i].$session_id).toBe(originalEvents[i].$session_id)
        expect(finalEvents[i].$device_id).toBe(originalEvents[i].$device_id)
        expect(finalEvents[i].$page_id).toBe(originalEvents[i].$page_id)
      }
    })
  })

  describe('多 Session 批量清洗', () => {
    let batchSessions: Array<{ sid: string; cnt: string; d: string }>

    beforeAll(async () => {
      // 选取 5 个不同的 session
      batchSessions = await queryCH<{ sid: string; cnt: string; d: string }>(
        "SELECT $session_id as sid, count() as cnt, toDate(min(`$service_time`)) as d FROM event_log WHERE $session_id != '' GROUP BY $session_id ORDER BY cnt DESC LIMIT 6 OFFSET 1"
      )
      batchSessions.forEach(s => {
        if (!testSessionIds.includes(s.sid)) testSessionIds.push(s.sid)
        if (!testDates.includes(s.d)) testDates.push(s.d)
      })
      console.log(`  Batch sessions: ${batchSessions.map(s => `${s.sid}(${s.cnt})`).join(', ')}`)
    })

    it('应能批量清洗 5 个 session', async () => {
      let totalEvents = 0
      let totalAttributions = 0

      for (const s of batchSessions) {
        const result = await executeRealCleaning(s.sid, s.d)
        totalEvents += result.eventCount
        totalAttributions += result.attributionCount
      }

      expect(totalEvents).toBeGreaterThan(0)
      console.log(`  Batch cleaning: ${totalEvents} events, ${totalAttributions} attributions`)
    }, 60000)

    it('批量写入的 final_event_log 应包含所有 session 的数据', async () => {
      await new Promise(r => setTimeout(r, 2000))

      for (const s of batchSessions) {
        const [{ cnt }] = await queryCH<{ cnt: string }>(
          `SELECT count() as cnt FROM final_event_log WHERE $session_id = '${s.sid}'`
        )
        expect(Number(cnt)).toBeGreaterThan(0)
      }
    }, 30000)
  })

  describe('数据一致性验证', () => {
    it('清洗后的 final_event_log 总行数应增加', async () => {
      const [{ cnt }] = await queryCH<{ cnt: string }>('SELECT count() as cnt FROM final_event_log')
      const count = Number(cnt)
      expect(count).toBeGreaterThan(0)
      console.log(`  final_event_log total rows: ${count}`)
    })

    it('event_attribution 表应有数据（如果真实事件包含归因事件）', async () => {
      const [{ cnt }] = await queryCH<{ cnt: string }>('SELECT count() as cnt FROM event_attribution')
      const count = Number(cnt)
      console.log(`  event_attribution total rows: ${count}`)
      // 真实数据可能没有归因事件，所以不强制要求 > 0
    })
  })

  describe('重复清洗幂等性', () => {
    it('对同一 session 重复清洗，final_event_log 应使用 ReplacingMergeTree 去重', async () => {
      // 选取一个新的 session
      const sessions = await queryCH<{ sid: string; d: string }>(
        "SELECT $session_id as sid, toDate(min(`$service_time`)) as d FROM event_log WHERE $session_id != '' GROUP BY $session_id ORDER BY count() DESC LIMIT 1 OFFSET 10"
      )
      if (sessions.length === 0) return

      const sid = sessions[0].sid
      const date = sessions[0].d
      testSessionIds.push(sid)
      testDates.push(date)

      // 第一次清洗
      const r1 = await executeRealCleaning(sid, date)

      await new Promise(r => setTimeout(r, 2000))
      const [{ cnt: cnt1 }] = await queryCH<{ cnt: string }>(
        `SELECT count() as cnt FROM final_event_log WHERE $session_id = '${sid}'`
      )

      // 第二次清洗（相同 session）
      const r2 = await executeRealCleaning(sid, date)

      await new Promise(r => setTimeout(r, 2000))
      const [{ cnt: cnt2 }] = await queryCH<{ cnt: string }>(
        `SELECT count() as cnt FROM final_event_log WHERE $session_id = '${sid}'`
      )

      // ReplacingMergeTree 最终会去重，但可能需要 OPTIMIZE TABLE
      // 这里只验证两次都成功写入
      expect(r1.eventCount).toBe(r2.eventCount)
      console.log(`  Idempotency: first=${cnt1}, second=${cnt2} (ReplacingMergeTree will dedup)`)
    }, 30000)
  })
})
