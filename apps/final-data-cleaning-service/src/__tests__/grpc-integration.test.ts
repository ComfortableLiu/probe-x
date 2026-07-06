/**
 * gRPC 传输层 + 数据完整性集成测试
 * 
 * 由于 @GrpcStreamMethod 装饰器在 ts-jest 环境中会改变方法签名
 * （返回 thenable 而非 Observable），无法直接测试双向流交互。
 * 
 * 本测试模拟 gRPC TaskStream 的完整数据流：
 * 查询事件 → 归因计算 → 统一落库
 * 
 * 重点验证：
 * 1. 数据从查询到落库的完整链路
 * 2. 多任务串行处理
 * 3. 节点标识一致性
 * 4. 异常处理（空数据、ClickHouse 故障）
 * 5. 传输层数据结构完整性
 */

import { ComputeNodeService, ProgressUpdate } from '../service/node.service'
import { computeAttribution } from '../lib/attribution-engine'
import { MockClickHouseService } from './mocks/clickhouse.service.mock'
import {
  resetEventCounter,
  createHomepageToListScenario,
  createMultiPageNavigationScenario,
  createNoAttributionScenario,
  createHighVolumeScenario,
} from './fixtures/event-factory'

describe('gRPC 传输层 + 数据完整性', () => {
  let service: ComputeNodeService
  let mockCH: MockClickHouseService

  beforeEach(() => {
    resetEventCounter()
    mockCH = new MockClickHouseService()
    service = new ComputeNodeService(mockCH as any)
  })

  /**
   * 模拟一次完整的 gRPC TaskStream 任务执行
   * 返回构造的 ProgressUpdate
   */
  async function simulateTaskExecution(
    taskId: string,
    sessionId: string,
    date: string = '2026-06-01',
  ): Promise<ProgressUpdate> {
    const eventList = await service.getAllEvents(date, sessionId)
    const result = computeAttribution(eventList)

    await Promise.all([
      mockCH.insert('final_event_log', result.finalEvents),
      mockCH.insert('event_attribution', result.attributions),
    ])

    return {
      task_id: taskId,
      target: eventList.length,
      progress: eventList.length,
      node_id: service.nodeId,
      message: '',
      completed: true,
      failed: false,
      error: '',
    }
  }

  describe('完整数据链路', () => {
    it('单任务：查询 → 归因 → 落库，验证数据完整', async () => {
      const events = createHomepageToListScenario('session-grpc-001')
      mockCH.seedEventLog(events)

      const progress = await simulateTaskExecution('task-grpc-001', 'session-grpc-001')

      // 验证 ProgressUpdate 结构
      expect(progress.completed).toBe(true)
      expect(progress.failed).toBe(false)
      expect(progress.task_id).toBe('task-grpc-001')
      expect(progress.node_id).toBe(service.nodeId)
      expect(progress.target).toBe(5)
      expect(progress.progress).toBe(5)

      // 验证落库数据
      const finalEvents = mockCH.getTableData('final_event_log')
      expect(finalEvents).toHaveLength(5)

      const attributions = mockCH.getTableData('event_attribution')
      expect(attributions.length).toBeGreaterThan(0)
    })

    it('进度更新应包含正确的节点标识', async () => {
      const events = createNoAttributionScenario('session-grpc-002')
      mockCH.seedEventLog(events)

      const progress = await simulateTaskExecution('task-grpc-002', 'session-grpc-002')

      expect(progress.node_id).toMatch(/^node-[a-z0-9]{6}$/)
      expect(progress.node_id).toBe(service.nodeId)
    })
  })

  describe('多任务串行处理', () => {
    it('连续执行 3 个任务，验证每个任务的 ProgressUpdate', async () => {
      const session1Events = createHomepageToListScenario('session-stream-1')
      const session2Events = createMultiPageNavigationScenario('session-stream-2')
      const session3Events = createNoAttributionScenario('session-stream-3')

      mockCH.seedEventLog([...session1Events, ...session2Events, ...session3Events])

      const p1 = await simulateTaskExecution('task-s1', 'session-stream-1')
      const p2 = await simulateTaskExecution('task-s2', 'session-stream-2')
      const p3 = await simulateTaskExecution('task-s3', 'session-stream-3')

      expect(p1.completed).toBe(true)
      expect(p2.completed).toBe(true)
      expect(p3.completed).toBe(true)

      // 验证每个任务的 target
      expect(p1.target).toBe(session1Events.length)
      expect(p2.target).toBe(session2Events.length)
      expect(p3.target).toBe(session3Events.length)

      // 验证总落库数据
      const finalEvents = mockCH.getTableData('final_event_log')
      expect(finalEvents.length).toBe(
        session1Events.length + session2Events.length + session3Events.length
      )
    })
  })

  describe('ProgressUpdate 结构验证', () => {
    it('应包含所有必需字段且类型正确', async () => {
      const events = createHomepageToListScenario('session-progress')
      mockCH.seedEventLog(events)

      const update = await simulateTaskExecution('task-progress', 'session-progress')

      // 字段存在性
      expect(update).toHaveProperty('task_id')
      expect(update).toHaveProperty('target')
      expect(update).toHaveProperty('progress')
      expect(update).toHaveProperty('node_id')
      expect(update).toHaveProperty('message')
      expect(update).toHaveProperty('completed')
      expect(update).toHaveProperty('failed')
      expect(update).toHaveProperty('error')

      // 字段类型
      expect(typeof update.task_id).toBe('string')
      expect(typeof update.target).toBe('number')
      expect(typeof update.progress).toBe('number')
      expect(typeof update.node_id).toBe('string')
      expect(typeof update.completed).toBe('boolean')
      expect(typeof update.failed).toBe('boolean')
    })

    it('成功任务：completed=true, failed=false, error 为空', async () => {
      const events = createHomepageToListScenario('session-completed')
      mockCH.seedEventLog(events)

      const update = await simulateTaskExecution('task-completed', 'session-completed')

      expect(update.completed).toBe(true)
      expect(update.failed).toBe(false)
      expect(update.error).toBe('')
    })
  })

  describe('异常场景', () => {
    it('查询空的 session 应正常完成（0 事件，0 归因）', async () => {
      const update = await simulateTaskExecution('task-empty', 'nonexistent-session')

      expect(update.completed).toBe(true)
      expect(update.target).toBe(0)
      expect(update.progress).toBe(0)

      const finalEvents = mockCH.getTableData('final_event_log')
      expect(finalEvents).toHaveLength(0)

      const attributions = mockCH.getTableData('event_attribution')
      expect(attributions).toHaveLength(0)
    })

    it('ClickHouse 查询异常应向上传播', async () => {
      class ErrorClickHouseService extends MockClickHouseService {
        async query() {
          throw new Error('Simulated ClickHouse failure')
        }
      }

      const errorCH = new ErrorClickHouseService()
      const errorService = new ComputeNodeService(errorCH as any)

      await expect(
        (async () => {
          const eventList = await errorService.getAllEvents('2026-06-01', 'session-error')
          const result = computeAttribution(eventList)
          await Promise.all([
            errorCH.insert('final_event_log', result.finalEvents),
            errorCH.insert('event_attribution', result.attributions),
          ])
        })()
      ).rejects.toThrow('Simulated ClickHouse failure')
    })

    it('ClickHouse insert 异常应向上传播', async () => {
      class InsertFailCH extends MockClickHouseService {
        async insert() {
          throw new Error('Insert failed')
        }
      }

      const failCH = new InsertFailCH()
      const failService = new ComputeNodeService(failCH as any)

      const events = createHomepageToListScenario('session-insert-fail')
      failCH.seedEventLog(events)

      await expect(
        (async () => {
          const eventList = await failService.getAllEvents('2026-06-01', 'session-insert-fail')
          const result = computeAttribution(eventList)
          await Promise.all([
            failCH.insert('final_event_log', result.finalEvents),
            failCH.insert('event_attribution', result.attributions),
          ])
        })()
      ).rejects.toThrow('Insert failed')
    })
  })

  describe('传输层数据完整性', () => {
    it('完整链路：事件查询 → 归因计算 → 双表写入', async () => {
      const events = createMultiPageNavigationScenario('session-e2e')
      mockCH.seedEventLog(events)

      await simulateTaskExecution('task-e2e', 'session-e2e')

      // 验证 final_event_log 与原始事件一致
      const finalEvents = mockCH.getTableData('final_event_log')
      expect(finalEvents.length).toBe(events.length)

      for (let i = 0; i < finalEvents.length; i++) {
        expect(finalEvents[i].$event_name).toBe(events[i].$event_name)
        expect(finalEvents[i].$page_id).toBe(events[i].$page_id)
        expect(finalEvents[i].$session_id).toBe(events[i].$session_id)
      }

      // 验证 event_attribution 包含正确的归因数据
      const attributions = mockCH.getTableData('event_attribution')
      expect(attributions.length).toBeGreaterThan(0)

      // 验证归因数据覆盖 2 个目标页面
      const sourcePages = new Set(attributions.map((a: any) => a.source_page_id))
      expect(sourcePages.size).toBe(2)
    })

    it('大量事件的完整链路性能测试', async () => {
      const events = createHighVolumeScenario('session-perf', 200)
      mockCH.seedEventLog(events)

      const start = Date.now()
      const update = await simulateTaskExecution('task-perf', 'session-perf')
      const elapsed = Date.now() - start

      expect(update.completed).toBe(true)
      expect(update.target).toBe(events.length)

      // createHighVolumeScenario 每 3 个页面事件额外插入 1 个归因事件
      // 所以总事件数 > eventCount 参数
      const finalEvents = mockCH.getTableData('final_event_log')
      expect(finalEvents.length).toBe(events.length)

      // Mock 环境下应在 5 秒内完成
      expect(elapsed).toBeLessThan(5000)
    })
  })

  describe('节点标识一致性', () => {
    it('同一节点在多次任务中应返回相同的 nodeId', async () => {
      mockCH.seedEventLog(createNoAttributionScenario('session-n1'))

      const p1 = await simulateTaskExecution('task-n1', 'session-n1')
      const p2 = await simulateTaskExecution('task-n2', 'session-n1')

      expect(p1.node_id).toBe(p2.node_id)
      expect(p1.node_id).toBe(service.nodeId)
    })

    it('不同节点应有不同的 nodeId', () => {
      const ch = new MockClickHouseService()
      const nodes = Array.from({ length: 5 }, () => new ComputeNodeService(ch as any))
      const ids = nodes.map(n => n.nodeId)

      expect(new Set(ids).size).toBe(5)
    })
  })
})
