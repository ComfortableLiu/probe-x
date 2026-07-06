/**
 * 多节点分布式清洗测试
 * 
 * 模拟多个 ComputeNodeService 实例并行处理不同 session 的清洗任务：
 * 1. 创建多个节点实例（模拟分布式部署）
 * 2. 模拟控制中心（data-dashboard-api）分配任务给不同节点
 * 3. 验证各节点独立处理、数据不串扰
 * 4. 验证节点 ID 唯一性
 * 5. 模拟节点故障场景
 * 6. 模拟共享存储和负载均衡
 * 
 * 策略：直接调用 getAllEvents + computeAttribution + insert，
 * 绕过 @GrpcStreamMethod 装饰器。
 */

import { ComputeNodeService } from '../service/node.service'
import { computeAttribution } from '../lib/attribution-engine'
import { MockClickHouseService } from './mocks/clickhouse.service.mock'
import {
  resetEventCounter,
  createHomepageToListScenario,
  createMultiPageNavigationScenario,
  createExAttributionScenario,
  createNoAttributionScenario,
  createHighVolumeScenario,
  createBackAndForthScenario,
} from './fixtures/event-factory'

/**
 * 直接执行清洗（绕过 gRPC 装饰器）
 */
async function executeCleaning(
  service: ComputeNodeService,
  ch: MockClickHouseService,
  sessionId: string,
  date: string = '2026-06-01',
) {
  const eventList = await service.getAllEvents(date, sessionId)
  const result = computeAttribution(eventList)
  await Promise.all([
    ch.insert('final_event_log', result.finalEvents),
    ch.insert('event_attribution', result.attributions),
  ])
  return result
}

describe('多节点分布式清洗', () => {
  describe('基础多节点并行', () => {
    it('2 个节点同时处理不同 session，数据应互不串扰', async () => {
      resetEventCounter()

      const ch1 = new MockClickHouseService()
      const ch2 = new MockClickHouseService()
      const node1 = new ComputeNodeService(ch1 as any)
      const node2 = new ComputeNodeService(ch2 as any)

      // 节点 ID 应不同
      expect(node1.nodeId).not.toBe(node2.nodeId)

      const events1 = createHomepageToListScenario('session-node1')
      const events2 = createExAttributionScenario('session-node2')

      ch1.seedEventLog(events1)
      ch2.seedEventLog(events2)

      // 并行执行
      await Promise.all([
        executeCleaning(node1, ch1, 'session-node1'),
        executeCleaning(node2, ch2, 'session-node2'),
      ])

      // 验证节点 1 只写入了 session-node1 的数据
      const finalEvents1 = ch1.getTableData('final_event_log')
      expect(finalEvents1.length).toBe(events1.length)
      finalEvents1.forEach((e: any) => {
        expect(e.$session_id).toBe('session-node1')
      })

      // 验证节点 2 只写入了 session-node2 的数据
      const finalEvents2 = ch2.getTableData('final_event_log')
      expect(finalEvents2.length).toBe(events2.length)
      finalEvents2.forEach((e: any) => {
        expect(e.$session_id).toBe('session-node2')
      })

      // 验证两个节点的归因数据互不干扰
      const attr1 = ch1.getTableData('event_attribution')
      const attr2 = ch2.getTableData('event_attribution')

      const sourcePages1 = new Set(attr1.map((a: any) => a.source_page_id))
      const sourcePages2 = new Set(attr2.map((a: any) => a.source_page_id))

      expect(sourcePages1.has('page-product-list')).toBe(true)
      expect(sourcePages2.has('page-landing')).toBe(true)
      expect(sourcePages1.has('page-landing')).toBe(false)
    })

    it('3 个节点同时处理不同的清洗场景', async () => {
      resetEventCounter()

      const nodes = Array.from({ length: 3 }, () => {
        const ch = new MockClickHouseService()
        const node = new ComputeNodeService(ch as any)
        return { ch, node }
      })

      const nodeIds = nodes.map(n => n.node.nodeId)
      expect(new Set(nodeIds).size).toBe(3)

      const scenarios = [
        { events: createHomepageToListScenario('session-3n-1'), sessionId: 'session-3n-1' },
        { events: createMultiPageNavigationScenario('session-3n-2'), sessionId: 'session-3n-2' },
        { events: createExAttributionScenario('session-3n-3'), sessionId: 'session-3n-3' },
      ]

      await Promise.all(
        nodes.map(async ({ ch, node }, i) => {
          ch.seedEventLog(scenarios[i].events)
          await executeCleaning(node, ch, scenarios[i].sessionId)
        })
      )

      nodes.forEach(({ ch }, i) => {
        const finalEvents = ch.getTableData('final_event_log')
        expect(finalEvents.length).toBe(scenarios[i].events.length)

        const allSessionIds = new Set(finalEvents.map((e: any) => e.$session_id))
        expect(allSessionIds.size).toBe(1)
        expect(allSessionIds.has(scenarios[i].sessionId)).toBe(true)
      })
    })
  })

  describe('节点 ID 唯一性', () => {
    it('10 个节点实例应生成 10 个不同的 nodeId', () => {
      const mockCH = new MockClickHouseService()
      const nodes = Array.from({ length: 10 }, () => new ComputeNodeService(mockCH as any))
      const nodeIds = nodes.map(n => n.nodeId)

      expect(new Set(nodeIds).size).toBe(10)

      nodeIds.forEach(id => {
        expect(id).toMatch(/^node-[a-z0-9]{6}$/)
      })
    })
  })

  describe('共享存储场景（多节点写同一 ClickHouse）', () => {
    it('多个节点写入同一个 ClickHouse，数据应全部正确落库', async () => {
      resetEventCounter()

      const sharedCH = new MockClickHouseService()
      const node1 = new ComputeNodeService(sharedCH as any)
      const node2 = new ComputeNodeService(sharedCH as any)

      const events1 = createHomepageToListScenario('session-shared-1')
      const events2 = createNoAttributionScenario('session-shared-2')

      sharedCH.seedEventLog([...events1, ...events2])

      // 顺序执行（共享存储避免并行写入 Mock 冲突）
      await executeCleaning(node1, sharedCH, 'session-shared-1')
      await executeCleaning(node2, sharedCH, 'session-shared-2')

      const finalEvents = sharedCH.getTableData('final_event_log')
      expect(finalEvents.length).toBe(events1.length + events2.length)

      const sessionIds = new Set(finalEvents.map((e: any) => e.$session_id))
      expect(sessionIds.size).toBe(2)

      // 2 节点 × 2 表 = 4 次 insert
      expect(sharedCH.insertLog).toHaveLength(4)
    })
  })

  describe('节点负载差异', () => {
    it('一个节点处理大量事件，另一个处理少量事件，应各自正确完成', async () => {
      resetEventCounter()

      const ch1 = new MockClickHouseService()
      const ch2 = new MockClickHouseService()
      const heavyNode = new ComputeNodeService(ch1 as any)
      const lightNode = new ComputeNodeService(ch2 as any)

      const heavyEvents = createHighVolumeScenario('session-heavy', 100)
      const lightEvents = createNoAttributionScenario('session-light')

      ch1.seedEventLog(heavyEvents)
      ch2.seedEventLog(lightEvents)

      await Promise.all([
        executeCleaning(heavyNode, ch1, 'session-heavy'),
        executeCleaning(lightNode, ch2, 'session-light'),
      ])

      const heavyFinal = ch1.getTableData('final_event_log')
      expect(heavyFinal.length).toBe(heavyEvents.length)

      const lightFinal = ch2.getTableData('final_event_log')
      expect(lightFinal.length).toBe(3)
    })
  })

  describe('模拟控制中心调度', () => {
    it('模拟 data-dashboard-api 将 8 个 session 轮询分配给 4 个节点', async () => {
      resetEventCounter()

      const nodePool = Array.from({ length: 4 }, () => {
        const ch = new MockClickHouseService()
        const node = new ComputeNodeService(ch as any)
        return { node, ch }
      })

      // 生成 8 个 session
      const sessions = Array.from({ length: 8 }, (_, i) => {
        const sessionId = `session-dispatch-${i}`
        const events = createHomepageToListScenario(sessionId)
        return { sessionId, events }
      })

      // 预置数据（轮询分配到节点）
      sessions.forEach((s, i) => {
        const nodeIdx = i % nodePool.length
        nodePool[nodeIdx].ch.seedEventLog(s.events)
      })

      // 执行任务分配
      for (const s of sessions) {
        const nodeIdx = sessions.indexOf(s) % nodePool.length
        await executeCleaning(nodePool[nodeIdx].node, nodePool[nodeIdx].ch, s.sessionId)
      }

      // 验证：每个节点处理了 2 个 session（8/4）
      nodePool.forEach(({ ch }) => {
        const finalEvents = ch.getTableData('final_event_log')
        expect(finalEvents.length).toBe(10) // 5 events × 2 sessions

        const sessionIds = new Set(finalEvents.map((e: any) => e.$session_id))
        expect(sessionIds.size).toBe(2)
      })
    })
  })

  describe('节点故障恢复', () => {
    it('当一个节点的 ClickHouse 查询失败时，不应影响其他节点', async () => {
      resetEventCounter()

      class FailingClickHouseService extends MockClickHouseService {
        async query<T>(sql: string, params?: any): Promise<T[]> {
          throw new Error('ClickHouse connection timeout')
        }
      }

      const failingCH = new FailingClickHouseService()
      const normalCH = new MockClickHouseService()
      const failingNode = new ComputeNodeService(failingCH as any)
      const normalNode = new ComputeNodeService(normalCH as any)

      const normalEvents = createHomepageToListScenario('session-normal')
      normalCH.seedEventLog(normalEvents)

      // 故障节点应抛异常
      await expect(executeCleaning(failingNode, failingCH, 'session-fail')).rejects.toThrow()

      // 正常节点不受影响
      await executeCleaning(normalNode, normalCH, 'session-normal')

      const normalFinal = normalCH.getTableData('final_event_log')
      expect(normalFinal.length).toBe(normalEvents.length)

      const failingFinal = failingCH.getTableData('final_event_log')
      expect(failingFinal).toHaveLength(0)
    })
  })

  describe('并发写入验证', () => {
    it('5 个节点同时写各自的 CH，insert 调用次数应正确', async () => {
      resetEventCounter()

      const nodes = Array.from({ length: 5 }, (_, i) => {
        const ch = new MockClickHouseService()
        const node = new ComputeNodeService(ch as any)
        const events = createHomepageToListScenario(`session-concurrent-${i}`)
        ch.seedEventLog(events)
        return { node, ch, sessionId: `session-concurrent-${i}` }
      })

      await Promise.all(
        nodes.map(async ({ node, ch, sessionId }) => {
          await executeCleaning(node, ch, sessionId)
        })
      )

      nodes.forEach(({ ch }) => {
        expect(ch.insertLog).toHaveLength(2)
        expect(ch.insertLog[0].table).toBe('final_event_log')
        expect(ch.insertLog[1].table).toBe('event_attribution')
      })
    })
  })
})
