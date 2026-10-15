import { Subject } from 'rxjs'
import { ComputeNodeService, ProgressUpdate } from '../service/node.service'
import { computeAttribution, AttributionEngineResult } from '../lib/attribution-engine'
import { AttributionWorkerPool } from '../lib/attribution-worker-pool'
import { MockClickHouseService } from './mocks/clickhouse.service.mock'
import { createMultiPageNavigationScenario, resetEventCounter } from './fixtures/event-factory'

function deferred<T>() {
  let resolve: (value: T) => void
  let reject: (error: Error) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve: resolve!, reject: reject! }
}

describe('计算节点的多线程归因接入', () => {
  const task = { task_id: 'parallel-task', session_id: 'parallel-session', date: '2026-06-01' }
  let clickhouse: MockClickHouseService
  let updates: ProgressUpdate[]
  let subject: Subject<ProgressUpdate>

  beforeEach(() => {
    resetEventCounter()
    clickhouse = new MockClickHouseService()
    clickhouse.seedEventLog(createMultiPageNavigationScenario(task.session_id))
    updates = []
    subject = new Subject<ProgressUpdate>()
    subject.subscribe(update => updates.push(update))
  })

  it('等待线程池结果后才写库，计算期间保持忙碌，全部写入后才上报完成', async () => {
    const computing = deferred<AttributionEngineResult>()
    const started = deferred<void>()
    const pool = {
      compute: jest.fn(() => {
        started.resolve()
        return computing.promise
      }),
    }
    const service = new ComputeNodeService(clickhouse as any, undefined, pool as unknown as AttributionWorkerPool)
    const running = service.executeTask(task, subject)
    await started.promise

    expect(service.currentTaskId).toBe(task.task_id)
    expect(clickhouse.insertLog).toHaveLength(0)
    expect(updates.some(update => update.completed)).toBe(false)
    const [events, reportProgress] = pool.compute.mock.calls[0] as unknown as Parameters<AttributionWorkerPool['compute']>
    reportProgress!(events.length, events.length)
    expect(updates[updates.length - 1].completed).toBe(false)

    computing.resolve(computeAttribution(events))
    await running

    expect(clickhouse.getTableData('final_event_log')).toEqual(events)
    expect(clickhouse.getTableData('event_attribution')).toEqual(computeAttribution(events).attributions)
    expect(updates[updates.length - 1]).toMatchObject({ completed: true, failed: false, progress: events.length })
    expect(updates.filter(update => update.completed)).toHaveLength(1)
    expect(service.currentTaskId).toBe('')
  })

  it('线程计算失败时不落库并通过任务进度报告失败', async () => {
    const pool = { compute: jest.fn().mockRejectedValue(new Error('worker exited')) }
    const service = new ComputeNodeService(clickhouse as any, undefined, pool as unknown as AttributionWorkerPool)

    await service.executeTask(task, subject)

    expect(clickhouse.insertLog).toHaveLength(0)
    expect(updates[updates.length - 1]).toMatchObject({ completed: false, failed: true, error: 'worker exited' })
    expect(updates.some(update => update.completed)).toBe(false)
    expect(service.currentTaskId).toBe('')
  })

  it('一张表写失败时，等待另一张写入结束再释放任务供重试', async () => {
    const attributionWrite = deferred<unknown>()
    const attributionStarted = deferred<void>()
    jest.spyOn(clickhouse, 'insert').mockImplementation(async table => {
      if (table === 'final_event_log') throw new Error('final write failed')
      attributionStarted.resolve()
      return attributionWrite.promise
    })
    const pool = { compute: jest.fn(async events => computeAttribution(events)) }
    const service = new ComputeNodeService(clickhouse as any, undefined, pool as unknown as AttributionWorkerPool)
    const running = service.executeTask(task, subject)
    await attributionStarted.promise
    await Promise.resolve()

    expect(service.currentTaskId).toBe(task.task_id)
    expect(updates.some(update => update.failed || update.completed)).toBe(false)

    attributionWrite.resolve({ executed: true })
    await running

    expect(updates[updates.length - 1]).toMatchObject({ failed: true, completed: false, error: 'final write failed' })
    expect(service.currentTaskId).toBe('')
  })
})
