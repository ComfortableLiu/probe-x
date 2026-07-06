/**
 * 单节点完整清洗流程测试
 * 
 * 测试策略：直接调用 getAllEvents + computeAttribution + insert，
 * 绕过 @GrpcStreamMethod 装饰器（该装饰器在纯 Jest 环境中会改变返回值）。
 * 这样测试的是真实的业务逻辑链路：查询 → 归因计算 → 落库。
 */

import { ComputeNodeService } from '../service/node.service'
import { computeAttribution } from '../lib/attribution-engine'
import { MockClickHouseService } from './mocks/clickhouse.service.mock'
import {
  resetEventCounter,
  createHomepageToListScenario,
  createMultiPageNavigationScenario,
  createNoAttributionScenario,
  createBackAndForthScenario,
  createExAttributionScenario,
  createHighVolumeScenario,
} from './fixtures/event-factory'

describe('单节点完整清洗流程', () => {
  let service: ComputeNodeService
  let mockCH: MockClickHouseService

  beforeEach(() => {
    resetEventCounter()
    mockCH = new MockClickHouseService()
    service = new ComputeNodeService(mockCH as any)
  })

  /**
   * 执行一次完整的清洗任务（绕过 gRPC 装饰器）
   * 等价于控制中心推送一个 ComputeTask 的完整效果
   */
  async function executeCleaning(sessionId: string, date: string = '2026-06-01') {
    const eventList = await service.getAllEvents(date, sessionId)
    const result = computeAttribution(eventList)
    await Promise.all([
      mockCH.insert('final_event_log', result.finalEvents),
      mockCH.insert('event_attribution', result.attributions),
    ])
    return result
  }

  describe('场景1：首页 → 商品列表（基础归因）', () => {
    it('应从 event_log 读取事件，清洗后写入 final_event_log 和 event_attribution', async () => {
      const sessionId = 'session-test-001'
      const events = createHomepageToListScenario(sessionId)
      mockCH.seedEventLog(events)

      const result = await executeCleaning(sessionId)

      // 验证 final_event_log 写入
      const finalEvents = mockCH.getTableData('final_event_log')
      expect(finalEvents).toHaveLength(5)
      expect(finalEvents[0].$event_name).toBe('page_view')
      expect(finalEvents[0].$session_id).toBe(sessionId)

      // 验证 event_attribution 写入
      const attributions = mockCH.getTableData('event_attribution')
      expect(attributions.length).toBeGreaterThan(0)

      // 验证归因数据包含正确的 source_page_id
      const sourcePages = new Set(attributions.map((a: any) => a.source_page_id))
      expect(sourcePages.has('page-product-list')).toBe(true)

      // 验证归因 KV 包含 SPM 字段（underlineToCamel 保留 $ 前缀）
      const keys = new Set(attributions.map((a: any) => a.attr_key))
      expect(keys.has('$spmA')).toBe(true)
      expect(keys.has('$spmB')).toBe(true)

      // 验证 insert 被调用了 2 次（final_event_log + event_attribution）
      expect(mockCH.insertLog).toHaveLength(2)
      expect(mockCH.insertLog[0].table).toBe('final_event_log')
      expect(mockCH.insertLog[1].table).toBe('event_attribution')
    })
  })

  describe('场景2：多级导航（home → list → detail）', () => {
    it('应生成 2 个页面的归因数据，且 detail 包含扩展参数', async () => {
      const sessionId = 'session-test-002'
      const events = createMultiPageNavigationScenario(sessionId)
      mockCH.seedEventLog(events)

      const result = await executeCleaning(sessionId)

      // 验证最终事件完整透传
      const finalEvents = mockCH.getTableData('final_event_log')
      expect(finalEvents.length).toBe(events.length)

      // 验证归因数据
      const attributions = mockCH.getTableData('event_attribution')

      // 应有 page-product-list 和 page-product-detail 两个页面的归因
      const sourcePages = new Set(attributions.map((a: any) => a.source_page_id))
      expect(sourcePages.size).toBe(2)
      expect(sourcePages.has('page-product-list')).toBe(true)
      expect(sourcePages.has('page-product-detail')).toBe(true)

      // detail 的归因应包含扩展参数
      const detailKV = attributions.filter((a: any) => a.source_page_id === 'page-product-detail')
      const detailKeys = detailKV.map((a: any) => a.attr_key)
      expect(detailKeys).toContain('$productId')
      expect(detailKeys).toContain('$productName')

      const productKV = detailKV.find((a: any) => a.attr_key === '$productId')
      expect(productKV?.attr_value).toBe('prod-001')
    })
  })

  describe('场景3：无归因事件', () => {
    it('应只写入 final_event_log，event_attribution 为空', async () => {
      const sessionId = 'session-test-003'
      const events = createNoAttributionScenario(sessionId)
      mockCH.seedEventLog(events)

      await executeCleaning(sessionId)

      const finalEvents = mockCH.getTableData('final_event_log')
      expect(finalEvents).toHaveLength(3)

      const attributions = mockCH.getTableData('event_attribution')
      expect(attributions).toHaveLength(0)
    })
  })

  describe('场景4：回退导航', () => {
    it('两个目标页面都应有归因数据', async () => {
      const sessionId = 'session-test-004'
      const events = createBackAndForthScenario(sessionId)
      mockCH.seedEventLog(events)

      await executeCleaning(sessionId)

      const attributions = mockCH.getTableData('event_attribution')
      const sourcePages = new Set(attributions.map((a: any) => a.source_page_id))

      expect(sourcePages.size).toBe(2)
      expect(sourcePages.has('page-product-list')).toBe(true)
      expect(sourcePages.has('page-product-detail')).toBe(true)
    })
  })

  describe('场景5：扩展归因参数', () => {
    it('$ex_attribution_params 中的自定义字段应被展开为 KV', async () => {
      const sessionId = 'session-test-005'
      const events = createExAttributionScenario(sessionId)
      mockCH.seedEventLog(events)

      await executeCleaning(sessionId)

      const attributions = mockCH.getTableData('event_attribution')
      const landingKV = attributions.filter((a: any) => a.source_page_id === 'page-landing')
      const keys = landingKV.map((a: any) => a.attr_key)

      expect(keys).toContain('$campaignId')
      expect(keys).toContain('$adGroup')
      expect(keys).toContain('$creativeId')
      expect(keys).toContain('$landingSource')
    })
  })

  describe('场景6：大量事件（性能与正确性）', () => {
    it('100 个事件应在合理时间内完成清洗', async () => {
      const sessionId = 'session-test-006'
      const events = createHighVolumeScenario(sessionId, 100)
      mockCH.seedEventLog(events)

      const startTime = Date.now()
      await executeCleaning(sessionId)
      const elapsed = Date.now() - startTime

      expect(elapsed).toBeLessThan(5000)

      const finalEvents = mockCH.getTableData('final_event_log')
      expect(finalEvents.length).toBe(events.length)

      const attributions = mockCH.getTableData('event_attribution')
      expect(attributions.length).toBeGreaterThan(0)
    })
  })

  describe('场景7：连续多任务处理', () => {
    it('同一节点应能连续处理多个不同 session 的任务', async () => {
      const events1 = createHomepageToListScenario('session-multi-001')
      const events2 = createExAttributionScenario('session-multi-002')
      mockCH.seedEventLog([...events1, ...events2])

      await executeCleaning('session-multi-001')
      await executeCleaning('session-multi-002')

      const finalEvents = mockCH.getTableData('final_event_log')
      expect(finalEvents.length).toBe(events1.length + events2.length)
    })
  })

  describe('数据完整性验证', () => {
    it('final_event_log 中的事件应与 event_log 中的原始数据一致', async () => {
      const sessionId = 'session-integrity'
      const events = createMultiPageNavigationScenario(sessionId)
      mockCH.seedEventLog(events)

      await executeCleaning(sessionId)

      const finalEvents = mockCH.getTableData('final_event_log')
      const originalEvents = mockCH.getTableData('event_log').filter(
        (e: any) => e.$session_id === sessionId
      )

      expect(finalEvents.length).toBe(originalEvents.length)

      for (let i = 0; i < finalEvents.length; i++) {
        expect(finalEvents[i].$event_name).toBe(originalEvents[i].$event_name)
        expect(finalEvents[i].$page_id).toBe(originalEvents[i].$page_id)
        expect(finalEvents[i].$session_id).toBe(originalEvents[i].$session_id)
      }
    })

    it('event_attribution 的 event_time 应为 Date 类型', async () => {
      const sessionId = 'session-time-check'
      const events = createHomepageToListScenario(sessionId)
      mockCH.seedEventLog(events)

      await executeCleaning(sessionId)

      const attributions = mockCH.getTableData('event_attribution')
      attributions.forEach((attr: any) => {
        expect(attr.event_time).toBeInstanceOf(Date)
      })
    })
  })

  describe('SQL 查询验证', () => {
    it('getAllEvents 应使用正确的日期和 sessionId 查询', async () => {
      const sessionId = 'session-sql'
      mockCH.seedEventLog(createNoAttributionScenario(sessionId))

      await service.getAllEvents('2026-06-01', sessionId)

      expect(mockCH.queryLog).toHaveLength(1)
      expect(mockCH.queryLog[0].params.queryDate).toBe('2026-06-01')
      expect(mockCH.queryLog[0].params.sessionId).toBe(sessionId)
      expect(mockCH.queryLog[0].sql).toContain('event_log')
      expect(mockCH.queryLog[0].sql).toContain('$session_id')
    })
  })
})
