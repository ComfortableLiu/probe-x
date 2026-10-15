import { Subject } from 'rxjs'
import { ComputeNodeService, ProgressUpdate } from '../service/node.service'
import { computeAttribution, AttributionEngineResult } from '../lib/attribution-engine'
import { AttributionWorkerPool } from '../lib/attribution-worker-pool'
import { MockClickHouseService } from './mocks/clickhouse.service.mock'
import { createMultiPageNavigationScenario, resetEventCounter } from './fixtures/event-factory'

function deferred<T>() {
  let resolve: (value: T) => void
  const promise = new Promise<T>(complete => { resolve = complete })
  return { promise, resolve: resolve! }
}

function progressStream() {
  const updates: ProgressUpdate[] = []
  const subject = new Subject<ProgressUpdate>()
  subject.subscribe(update => updates.push(update))
  return { updates, subject }
}

const taskFor = (id: string, session = `session-${id}`) => ({
  task_id: id,
  session_id: session,
  date: '2026-06-01',
})

describe('计算节点的多任务并发', () => {
  let clickhouse: MockClickHouseService

  beforeEach(() => {
    resetEventCounter()
    clickhouse = new MockClickHouseService()
  })

  afterEach(() => jest.restoreAllMocks())

  it('两个 session 同时计算和落库，各自独立上报并保留其他任务的忙碌状态', async () => {
    const tasks = [taskFor('first'), taskFor('second')]
    const calculations = tasks.map(() => deferred<AttributionEngineResult>())
    const computing = tasks.map(() => deferred<void>())
    const writes = tasks.map(() => deferred<void>())
    const writing = tasks.map(() => deferred<void>())
    const streams = tasks.map(() => progressStream())
    const pool = {
      concurrency: 2,
      compute: jest.fn(events => {
        const index = tasks.findIndex(task => task.session_id === events[0].$session_id)
        computing[index].resolve()
        return calculations[index].promise
      }),
    }
    const insert = clickhouse.insert.bind(clickhouse)
    jest.spyOn(clickhouse, 'insert').mockImplementation(async (table, data) => {
      const row = data[0] as any
      const index = tasks.findIndex(task => task.session_id === (row.$session_id || row.session_id))
      writing[index].resolve()
      await writes[index].promise
      return insert(table, data)
    })
    tasks.forEach(task => clickhouse.seedEventLog(createMultiPageNavigationScenario(task.session_id)))
    const service = new ComputeNodeService(clickhouse as any, undefined, pool as unknown as AttributionWorkerPool)
    const running = tasks.map((task, index) => service.executeTask(task, streams[index].subject))

    await Promise.all(computing.map(start => start.promise))
    expect(service.taskCapacity).toBe(2)
    expect(service.currentTaskIds).toEqual(tasks.map(task => task.task_id))
    expect(clickhouse.insertLog).toHaveLength(0)

    pool.compute.mock.calls.forEach(([events], index) => calculations[index].resolve(computeAttribution(events)))
    await Promise.all(writing.map(start => start.promise))
    expect(streams.every(stream => stream.updates.every(update => !update.completed))).toBe(true)

    writes[0].resolve()
    await running[0]
    expect(service.currentTaskId).toBe(tasks[1].task_id)
    expect(service.activeTaskCount).toBe(1)
    expect(service.getLocalNodeInfo()).toMatchObject({
      busy: true,
      busy_task_id: tasks[1].task_id,
      active_task_ids: [tasks[1].task_id],
      task_capacity: 2,
    })
    expect(streams[0].updates[streams[0].updates.length - 1].completed).toBe(true)
    expect(streams[1].updates.every(update => !update.completed)).toBe(true)

    writes[1].resolve()
    await running[1]
    streams.forEach((stream, index) => {
      expect(stream.updates.every(update => update.task_id === tasks[index].task_id)).toBe(true)
      expect(stream.updates.filter(update => update.completed)).toHaveLength(1)
      expect(clickhouse.getTableData('final_event_log').some(event => event.$session_id === tasks[index].session_id)).toBe(true)
    })
    expect(service.currentTaskIds).toEqual([])
    expect(service.getLocalNodeInfo().busy).toBe(false)
  })

  it('超容量任务在完整任务结束之前排队，不提前读取 ClickHouse 事件', async () => {
    const tasks = [taskFor('first'), taskFor('second'), taskFor('third')]
    const calculations = tasks.map(() => deferred<AttributionEngineResult>())
    const computing = tasks.map(() => deferred<void>())
    const firstWriting = deferred<void>()
    const firstWrite = deferred<void>()
    const pool = {
      concurrency: 2,
      compute: jest.fn(events => {
        const index = tasks.findIndex(task => task.session_id === events[0].$session_id)
        computing[index].resolve()
        return calculations[index].promise
      }),
    }
    const insert = clickhouse.insert.bind(clickhouse)
    jest.spyOn(clickhouse, 'insert').mockImplementation(async (table, data) => {
      if (table === 'final_event_log' && (data[0] as any).$session_id === tasks[0].session_id) {
        firstWriting.resolve()
        await firstWrite.promise
      }
      return insert(table, data)
    })
    tasks.forEach(task => clickhouse.seedEventLog(createMultiPageNavigationScenario(task.session_id)))
    const service = new ComputeNodeService(clickhouse as any, undefined, pool as unknown as AttributionWorkerPool)
    const running = tasks.map(task => service.executeTask(task, progressStream().subject))
    await Promise.all(computing.slice(0, 2).map(start => start.promise))

    expect(service.activeTaskCount).toBe(3)
    expect(service.getLocalNodeInfo().active_task_ids).toEqual(tasks.map(task => task.task_id))
    expect(clickhouse.queryLog.some(query => query.params.sessionId === tasks[2].session_id)).toBe(false)

    calculations[0].resolve(computeAttribution(pool.compute.mock.calls[0][0]))
    await firstWriting.promise
    expect(clickhouse.queryLog.some(query => query.params.sessionId === tasks[2].session_id)).toBe(false)
    firstWrite.resolve()
    await computing[2].promise
    expect(clickhouse.queryLog.some(query => query.params.sessionId === tasks[2].session_id)).toBe(true)
    calculations[1].resolve(computeAttribution(pool.compute.mock.calls[1][0]))
    calculations[2].resolve(computeAttribution(pool.compute.mock.calls[2][0]))
    await Promise.all(running)
    expect(service.activeTaskCount).toBe(0)
  })

  it('运行中的相同 task_id 共享执行及真实终态，不能通过 Redis NX 提前完成', async () => {
    const task = taskFor('duplicate')
    const calculation = deferred<AttributionEngineResult>()
    const computing = deferred<void>()
    const redis = { setNx: jest.fn().mockResolvedValueOnce(true).mockResolvedValue(false) }
    const pool = {
      concurrency: 2,
      compute: jest.fn(() => {
        computing.resolve()
        return calculation.promise
      }),
    }
    clickhouse.seedEventLog(createMultiPageNavigationScenario(task.session_id))
    const service = new ComputeNodeService(clickhouse as any, redis as any, pool as unknown as AttributionWorkerPool)
    const first = progressStream()
    const replay = progressStream()
    const running = service.executeTask(task, first.subject)
    await computing.promise
    const replaying = service.executeTask(task, replay.subject)

    expect(service.activeTaskCount).toBe(1)
    expect(redis.setNx).toHaveBeenCalledTimes(1)
    expect(pool.compute).toHaveBeenCalledTimes(1)
    expect(replay.updates.every(update => !update.completed)).toBe(true)

    calculation.resolve(computeAttribution(clickhouse.getTableData('event_log')))
    await Promise.all([running, replaying])
    for (const stream of [first, replay]) {
      expect(stream.updates.filter(update => update.completed)).toHaveLength(1)
      expect(stream.updates[stream.updates.length - 1]).toMatchObject({ target: 7, completed: true })
    }
    expect(clickhouse.insertLog.filter(insert => insert.table === 'final_event_log')).toHaveLength(1)
  })

  it('已 unsubscribe 的进度 Subject 不阻断完成、容量释放及其他订阅者终态', async () => {
    const task = taskFor('closed-subject')
    const calculation = deferred<AttributionEngineResult>()
    const computing = deferred<void>()
    const pool = {
      concurrency: 1,
      compute: jest.fn(events => {
        if (events.length === 0) return Promise.resolve(computeAttribution(events))
        computing.resolve()
        return calculation.promise
      }),
    }
    clickhouse.seedEventLog(createMultiPageNavigationScenario(task.session_id))
    const service = new ComputeNodeService(clickhouse as any, undefined, pool as unknown as AttributionWorkerPool)
    const closed = progressStream()
    const live = progressStream()
    const running = service.executeTask(task, closed.subject)
    await computing.promise
    const replaying = service.executeTask(task, live.subject)
    closed.subject.unsubscribe()
    calculation.resolve(computeAttribution(clickhouse.getTableData('event_log')))

    await Promise.all([running, replaying])
    expect(live.updates[live.updates.length - 1]).toMatchObject({ completed: true, failed: false })
    expect(service.activeTaskCount).toBe(0)
    expect(service.lastError).toBe('')
    await service.executeTask(taskFor('after-closed-subject'), progressStream().subject)
    expect(service.activeTaskCount).toBe(0)
  })

  it('同一 date/session 的不同重试任务等待全部旧写入结束，其他 session 可并发', async () => {
    const first = taskFor('original', 'shared-session')
    const retry = taskFor('original:r1', first.session_id)
    const other = taskFor('other')
    const writeGate = deferred<void>()
    const writing = deferred<void>()
    const pool = { concurrency: 2, compute: jest.fn(async events => computeAttribution(events)) }
    const originalInsert = clickhouse.insert.bind(clickhouse)
    jest.spyOn(clickhouse, 'insert').mockImplementation(async (table, data) => {
      if (table === 'final_event_log' && (data[0] as any).$session_id === first.session_id) {
        writing.resolve()
        await writeGate.promise
      }
      return originalInsert(table, data)
    })
    const originalQuery = clickhouse.query.bind(clickhouse)
    jest.spyOn(clickhouse, 'query').mockImplementation(async (sql, params) => {
      if (sql.includes('FROM final_event_log')) {
        return clickhouse.getTableData('final_event_log').filter(event => event.$session_id === params.sessionId)
      }
      if (sql.includes('FROM event_attribution')) {
        return clickhouse.getTableData('event_attribution').filter(row => row.session_id === params.sessionId)
      }
      return originalQuery(sql, params)
    })
    clickhouse.seedEventLog(createMultiPageNavigationScenario(first.session_id))
    clickhouse.seedEventLog(createMultiPageNavigationScenario(other.session_id))
    const service = new ComputeNodeService(clickhouse as any, undefined, pool as unknown as AttributionWorkerPool)
    const running = service.executeTask(first, progressStream().subject)
    await writing.promise
    const retrying = service.executeTask(retry, progressStream().subject)
    const unrelated = service.executeTask(other, progressStream().subject)
    await unrelated

    expect(pool.compute).toHaveBeenCalledTimes(2)
    expect(clickhouse.queryLog.filter(query => query.params.sessionId === first.session_id)).toHaveLength(1)
    expect(service.currentTaskIds).toEqual([first.task_id, retry.task_id])

    writeGate.resolve()
    await Promise.all([running, retrying])
    expect(pool.compute).toHaveBeenCalledTimes(3)
    expect(clickhouse.insertLog.filter(insert => insert.table === 'final_event_log' && insert.data[0].$session_id === first.session_id)).toHaveLength(1)
    expect(service.activeTaskCount).toBe(0)
  })

  it('终态回调同步下发下一任务时，先释放容量且不会清除新任务状态', async () => {
    const first = taskFor('first')
    const next = taskFor('next')
    const nextCalculation = deferred<AttributionEngineResult>()
    const nextComputing = deferred<void>()
    const pool = {
      concurrency: 1,
      compute: jest.fn(async events => {
        if (events[0].$session_id === next.session_id) {
          nextComputing.resolve()
          return nextCalculation.promise
        }
        return computeAttribution(events)
      }),
    }
    clickhouse.seedEventLog(createMultiPageNavigationScenario(first.session_id))
    clickhouse.seedEventLog(createMultiPageNavigationScenario(next.session_id))
    const service = new ComputeNodeService(clickhouse as any, undefined, pool as unknown as AttributionWorkerPool)
    const stream = progressStream()
    let nextRunning: Promise<void> | undefined
    stream.subject.subscribe(update => {
      if (!update.completed) return
      expect(service.activeTaskCount).toBe(0)
      nextRunning = service.executeTask(next, progressStream().subject)
      expect(service.currentTaskIds).toEqual([next.task_id])
    })

    await service.executeTask(first, stream.subject)
    await nextComputing.promise
    expect(service.currentTaskIds).toEqual([next.task_id])
    nextCalculation.resolve(computeAttribution(clickhouse.getTableData('event_log').filter(event => event.$session_id === next.session_id)))
    await nextRunning
    expect(service.currentTaskIds).toEqual([])
  })

  it('一个任务计算失败只释放自己的容量，不影响其他任务的进度及写入', async () => {
    const tasks = [taskFor('failed'), taskFor('successful')]
    const calculations = tasks.map(() => deferred<AttributionEngineResult>())
    const computing = tasks.map(() => deferred<void>())
    const streams = tasks.map(() => progressStream())
    const pool = {
      concurrency: 2,
      compute: jest.fn(async events => {
        const index = tasks.findIndex(task => task.session_id === events[0].$session_id)
        computing[index].resolve()
        const result = await calculations[index].promise
        if (index === 0) throw new Error('worker failed')
        return result
      }),
    }
    tasks.forEach(task => clickhouse.seedEventLog(createMultiPageNavigationScenario(task.session_id)))
    const service = new ComputeNodeService(clickhouse as any, undefined, pool as unknown as AttributionWorkerPool)
    const running = tasks.map((task, index) => service.executeTask(task, streams[index].subject))
    await Promise.all(computing.map(start => start.promise))

    calculations[0].resolve(computeAttribution(pool.compute.mock.calls[0][0]))
    await running[0]
    expect(streams[0].updates[streams[0].updates.length - 1]).toMatchObject({ failed: true, completed: false, error: 'worker failed' })
    expect(service.currentTaskIds).toEqual([tasks[1].task_id])
    expect(streams[1].updates.every(update => !update.failed && !update.completed)).toBe(true)
    expect(clickhouse.insertLog).toHaveLength(0)

    calculations[1].resolve(computeAttribution(pool.compute.mock.calls[1][0]))
    await running[1]
    expect(streams[1].updates[streams[1].updates.length - 1]).toMatchObject({ failed: false, completed: true })
    expect(clickhouse.getTableData('final_event_log').every(event => event.$session_id === tasks[1].session_id)).toBe(true)
    expect(service.activeTaskCount).toBe(0)
  })
})
