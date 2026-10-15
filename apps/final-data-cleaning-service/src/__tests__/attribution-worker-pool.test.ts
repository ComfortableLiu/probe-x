import { EventEmitter } from 'node:events'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir, availableParallelism } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { Worker } from 'node:worker_threads'
import { types as utilTypes } from 'node:util'
import * as ts from 'typescript'
import { IPreEventLog } from '@probe-x/shared-types/src'
import { computeAttribution } from '../lib/attribution-engine'
import { AttributionWorkerPool } from '../lib/attribution-worker-pool'
import {
  AttributionWorkerRequest,
  AttributionWorkerResponse,
} from '../lib/attribution-worker.types'
import { createBaseEvent, resetEventCounter } from './fixtures/event-factory'

class ControlledWorker extends EventEmitter {
  requests: AttributionWorkerRequest[] = []
  current?: AttributionWorkerRequest
  postError?: Error
  terminate = jest.fn(async () => 0)
  ref = jest.fn()
  unref = jest.fn()

  postMessage(request: AttributionWorkerRequest) {
    if (this.postError) throw this.postError
    // 模拟 Worker structured clone，不能意外依赖共享事件对象。
    this.current = structuredClone(request)
    this.requests.push(this.current)
  }

  progress(processed: number) {
    const request = this.current!
    this.respond({ type: 'progress', taskId: request.taskId, processed, total: request.events.length })
  }

  finish() {
    const request = this.current!
    this.current = undefined
    this.respond({
      type: 'result',
      taskId: request.taskId,
      attributions: computeAttribution(request.events).attributions,
    })
  }

  respond(response: AttributionWorkerResponse) {
    this.emit('message', structuredClone(response))
  }
}

let nextSessionId = 1

function createEvents(count: number) {
  const sessionId = `session-${nextSessionId++}`
  return Array.from({ length: count }, (_, index) => createBaseEvent({
    $session_id: sessionId,
    $is_attribution_event: index % 4 !== 0,
    $target_page_id: `page-${index}`,
    $ex_attribution_params: index % 7 === 0
      ? '{invalid json'
      : index % 3 === 0
        ? { $campaign_id: `campaign-${index}`, $item_count: index }
        : JSON.stringify({ $campaign_id: `campaign-${index}`, $enabled: true }),
  }))
}

const nextTurn = () => new Promise<void>(resolveTurn => setImmediate(resolveTurn))

describe('归因 Worker 线程池', () => {
  let workers: ControlledWorker[]
  let pools: AttributionWorkerPool[]

  function createPool(concurrency = 3, firstWorkerPostError?: Error) {
    const pool = new AttributionWorkerPool({
      concurrency,
      workerFactory: () => {
        const worker = new ControlledWorker()
        if (workers.length === 0) worker.postError = firstWorkerPostError
        workers.push(worker)
        return worker
      },
    })
    pools.push(pool)
    return pool
  }

  beforeEach(() => {
    resetEventCounter()
    nextSessionId = 1
    workers = []
    pools = []
  })

  afterEach(async () => {
    await Promise.all(pools.map(pool => pool.onModuleDestroy()))
  })

  it('默认并发数来自运行环境可用的 CPU 逻辑线程数，空任务不启动线程', async () => {
    const workerFactory = jest.fn(() => new ControlledWorker())
    const pool = new AttributionWorkerPool({ workerFactory })
    pools.push(pool)
    const events: IPreEventLog[] = []
    const result = await pool.compute(events)

    expect(pool.concurrency).toBe(availableParallelism())
    expect(result).toEqual({ finalEvents: [], attributions: [] })
    expect(result.finalEvents).toBe(events)
    expect(workerFactory).not.toHaveBeenCalled()
  })

  it('多个完整 session 并发执行，超过 CPU 上限的任务按顺序排队', async () => {
    const pool = createPool(3)
    const eventLists = [12, 8, 3, 1, 2].map(createEvents)
    const results = eventLists.map(events => pool.compute(events))
    await nextTurn()

    expect(workers).toHaveLength(3)
    expect(workers.every(worker => worker.current)).toBe(true)
    workers.forEach((worker, index) => {
      expect(worker.current!.events.map(event => event.$event_id))
        .toEqual(eventLists[index].map(event => event.$event_id))
    })
    expect(workers.map(worker => worker.requests.length)).toEqual([1, 1, 1])

    workers[1].finish()
    workers[0].finish()
    expect(workers[1].current!.events.map(event => event.$event_id))
      .toEqual(eventLists[3].map(event => event.$event_id))
    expect(workers[0].current!.events.map(event => event.$event_id))
      .toEqual(eventLists[4].map(event => event.$event_id))
    workers.forEach(worker => worker.finish())
    const completed = await Promise.all(results)
    completed.forEach((result, index) => {
      expect(result.finalEvents).toBe(eventLists[index])
      expect(result.attributions).toEqual(computeAttribution(eventLists[index]).attributions)
    })
    expect(workers.map(worker => worker.requests.length)).toEqual([2, 2, 1])
  })

  it('小 session 也在 worker 执行，连续清洗复用同一个线程', async () => {
    const pool = createPool(4)
    const first = pool.compute(createEvents(2))
    await nextTurn()
    expect(workers).toHaveLength(1)
    workers.forEach(worker => worker.finish())
    await first

    const second = pool.compute(createEvents(2))
    await nextTurn()
    expect(workers).toHaveLength(1)
    workers.forEach(worker => worker.finish())
    await second
    expect(workers.map(worker => worker.requests.length)).toEqual([2])
    expect(workers[0].ref).toHaveBeenCalledTimes(2)
    expect(workers[0].unref).toHaveBeenCalledTimes(3)
  })

  it('一个大 session 只占一个线程，小 session 可以同时使用另一个线程', async () => {
    const pool = createPool(8)
    const events = createEvents(6001)
    const large = pool.compute(events)
    await nextTurn()
    expect(workers).toHaveLength(1)
    expect(workers[0].current!.events).toHaveLength(events.length)
    expect(Object.keys(workers[0].current!.events[0]).sort()).toEqual([
      '$event_id', '$ex_attribution_params', '$is_attribution_event',
      '$service_time', '$session_id', '$target_page_id',
    ])

    const small = pool.compute(createEvents(2))
    await nextTurn()
    expect(workers).toHaveLength(2)
    workers[1].finish()
    await small
    expect(workers[0].current!.events).toHaveLength(events.length)
    workers[0].finish()
    await large
  })

  it('不同 session 乱序完成仍保留各自的事件顺序、引用与日期类型', async () => {
    const pool = createPool(3)
    const events = createEvents(11)
    const expected = computeAttribution(events)
    const eventLists = [events, createEvents(5), createEvents(3)]
    const resultPromises = eventLists.map(eventList => pool.compute(eventList))
    await nextTurn()

    workers[2].finish()
    workers[0].finish()
    workers[1].finish()
    const [result, ...otherResults] = await Promise.all(resultPromises)

    expect(result.attributions).toEqual(expected.attributions)
    expect(result.finalEvents).toBe(events)
    expect(result.finalEvents[0]).toBe(events[0])
    result.attributions.forEach(attribution => {
      // Jest 沙箱与 Node structuredClone 使用不同 Realm 的 Date 构造器。
      expect(utilTypes.isDate(attribution.event_time)).toBe(true)
    })
    otherResults.forEach((other, index) => {
      expect(other.finalEvents).toBe(eventLists[index + 1])
      expect(other.attributions).toEqual(computeAttribution(eventLists[index + 1]).attributions)
    })
  })

  it('不同 session 的进度交错时完全隔离，每个任务的进度单调到完成', async () => {
    const pool = createPool(3)
    const eventLists = [12, 8, 5].map(createEvents)
    const callbacks = eventLists.map(() => jest.fn())
    const resultPromises = eventLists.map((events, index) => pool.compute(events, callbacks[index]))
    await nextTurn()

    workers[2].progress(2)
    workers[0].progress(1)
    workers[1].progress(3)
    workers[2].finish()
    workers[1].finish()
    workers[0].finish()
    await Promise.all(resultPromises)

    expect(callbacks[0].mock.calls).toEqual([[1, 12], [12, 12]])
    expect(callbacks[1].mock.calls).toEqual([[3, 8], [8, 8]])
    expect(callbacks[2].mock.calls).toEqual([[2, 5], [5, 5]])
  })

  it('忽略旧任务消息和倒退、重复、无效的进度', async () => {
    const pool = createPool(1)
    const first = pool.compute(createEvents(4))
    await nextTurn()
    const oldTaskId = workers[0].current!.taskId
    workers[0].finish()
    await first

    const progress = jest.fn()
    const events = createEvents(5)
    const second = pool.compute(events, progress)
    await nextTurn()
    workers[0].respond({ type: 'result', taskId: oldTaskId, attributions: [] })
    workers[0].respond({ type: 'progress', taskId: oldTaskId, processed: 5, total: 5 })
    workers[0].progress(3)
    workers[0].progress(1)
    workers[0].progress(3)
    workers[0].progress(Number.NaN)
    expect(progress.mock.calls).toEqual([[3, 5]])
    workers[0].finish()
    expect((await second).attributions).toEqual(computeAttribution(events).attributions)
    expect(progress).toHaveBeenLastCalledWith(5, 5)
  })

  it('进度回调异常等待自身线程结束，其他 session 正常完成', async () => {
    const pool = createPool(2)
    const progress = jest.fn(() => { throw new Error('progress stream closed') })
    let settled = false
    const failed = pool.compute(createEvents(8), progress).catch(error => {
      settled = true
      return error
    })
    const survivingEvents = createEvents(7)
    const survivingProgress = jest.fn()
    const surviving = pool.compute(survivingEvents, survivingProgress)
    await nextTurn()
    workers[0].progress(1)
    workers[1].progress(2)
    workers[1].finish()
    expect((await surviving).attributions).toEqual(computeAttribution(survivingEvents).attributions)
    await nextTurn()
    expect(settled).toBe(false)
    workers[0].progress(3)
    workers[0].finish()
    expect((await failed).message).toBe('progress stream closed')
    expect(progress).toHaveBeenCalledTimes(1)
    expect(survivingProgress.mock.calls).toEqual([[2, 7], [7, 7]])

    const events = createEvents(6)
    const restored = pool.compute(events)
    await nextTurn()
    workers.filter(worker => worker.current).forEach(worker => worker.finish())
    expect((await restored).attributions).toEqual(computeAttribution(events).attributions)
  })

  it.each(['error', 'exit-zero', 'response-error'] as const)(
    '%s 仅拒绝故障 session，其他 session 继续执行且线程可重建',
    async failure => {
      const pool = createPool(2)
      const progress = jest.fn()
      const failed = pool.compute(createEvents(8), progress).then(
        () => { throw new Error('失败的清洗不应成功') },
        error => error,
      )
      const survivingEvents = createEvents(7)
      const surviving = pool.compute(survivingEvents)
      const queuedEvents = createEvents(6)
      const queued = pool.compute(queuedEvents)
      await nextTurn()
      const failingWorker = workers[0]
      const survivingWorker = workers[1]

      if (failure === 'error') failingWorker.emit('error', new Error('worker crashed'))
      else if (failure === 'exit-zero') failingWorker.emit('exit', 0)
      else failingWorker.respond({
        type: 'error',
        taskId: failingWorker.current!.taskId,
        error: { message: 'bad attribution input' },
      })
      await nextTurn()
      expect(await failed).toBeInstanceOf(Error)
      expect(survivingWorker.current).toBeDefined()
      expect(workers).toHaveLength(3)
      const progressAfterFailure = progress.mock.calls.length
      failingWorker.progress(3)
      survivingWorker.progress(2)
      survivingWorker.finish()
      workers[2].finish()
      expect((await surviving).attributions).toEqual(computeAttribution(survivingEvents).attributions)
      expect((await queued).attributions).toEqual(computeAttribution(queuedEvents).attributions)
      expect(progress.mock.calls).toHaveLength(progressAfterFailure)

      const nextEvents = createEvents(6)
      const restored = pool.compute(nextEvents)
      await nextTurn()
      workers.filter(worker => worker.current && worker !== failingWorker).forEach(worker => worker.finish())
      expect((await restored).attributions).toEqual(computeAttribution(nextEvents).attributions)
      expect(failingWorker.terminate).toHaveBeenCalledTimes(1)
    },
  )

  it('postMessage 同步抛错会拒绝清洗，移除故障线程且下次可恢复', async () => {
    const pool = createPool(2, new Error('cannot clone event'))
    const failed = pool.compute(createEvents(8)).catch(error => error)
    const otherEvents = createEvents(3)
    const other = pool.compute(otherEvents)
    await nextTurn()
    workers.filter(worker => worker.current).forEach(worker => worker.finish())
    expect(await failed).toBeInstanceOf(Error)
    expect((await other).attributions).toEqual(computeAttribution(otherEvents).attributions)

    const events = createEvents(5)
    const restored = pool.compute(events)
    await nextTurn()
    workers.filter(worker => worker.current).forEach(worker => worker.finish())
    expect((await restored).attributions).toEqual(computeAttribution(events).attributions)
    expect(workers).toHaveLength(2)
    expect(workers[0].terminate).toHaveBeenCalledTimes(1)
  })

  it('创建线程失败只拒绝当前 session，后续任务可以重试创建', async () => {
    let first = true
    const pool = new AttributionWorkerPool({
      concurrency: 2,
      workerFactory: () => {
        if (first) {
          first = false
          throw new Error('cannot create worker')
        }
        const worker = new ControlledWorker()
        workers.push(worker)
        return worker
      },
    })
    pools.push(pool)
    await expect(pool.compute(createEvents(3))).rejects.toThrow('cannot create worker')
    const events = createEvents(4)
    const restored = pool.compute(events)
    workers[0].finish()
    expect((await restored).attributions).toEqual(computeAttribution(events).attributions)
  })

  it.each([0, -1, 1.5, Number.NaN])('拒绝无效的线程并发数 %s', concurrency => {
    expect(() => new AttributionWorkerPool({ concurrency })).toThrow('positive integer')
  })

  it('关闭时拒绝在途、排队及后续任务，并终止所有线程', async () => {
    const pool = createPool(2)
    const active = pool.compute(createEvents(8)).catch(error => error)
    const secondActive = pool.compute(createEvents(3)).catch(error => error)
    const queued = pool.compute(createEvents(4)).catch(error => error)
    await nextTurn()

    await pool.onModuleDestroy()
    expect(await active).toBeInstanceOf(Error)
    expect(await secondActive).toBeInstanceOf(Error)
    expect(await queued).toBeInstanceOf(Error)
    await expect(pool.compute(createEvents(1))).rejects.toThrow()
    expect(workers).toHaveLength(2)
    workers.forEach(worker => expect(worker.terminate).toHaveBeenCalledTimes(1))
    await pool.onModuleDestroy()
    workers.forEach(worker => expect(worker.terminate).toHaveBeenCalledTimes(1))
  })
})

/**
 * 编译真实 worker 及其纯函数依赖后启动 Node Worker，防止仅靠 fake worker
 * 掩盖线程入口、消息协议和 structured clone 类型问题。不在 worker 中 require TS。
 */
function compileWorkerFixture(outputDir: string) {
  const serviceSource = resolve(__dirname, '..')
  const sharedSource = resolve(__dirname, '../../../../libs/shared-utils/src')
  const sources = [
    [join(serviceSource, 'lib/attribution-worker.ts'), 'lib/attribution-worker.js'],
    [join(serviceSource, 'lib/attribution-engine.ts'), 'lib/attribution-engine.js'],
    [join(sharedSource, 'index.ts'), 'shared/index.js'],
    [join(sharedSource, 'lib/index.ts'), 'shared/lib/index.js'],
    [join(sharedSource, 'lib/attribution.ts'), 'shared/lib/attribution.js'],
    [join(sharedSource, 'lib/static-constants.ts'), 'shared/lib/static-constants.js'],
  ]
  sources.forEach(([sourcePath, outputPath]) => {
    const source = readFileSync(sourcePath, 'utf8')
      .replaceAll('@probe-x/shared-utils/src', '../shared')
    const compiled = ts.transpileModule(source, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
      fileName: sourcePath,
    }).outputText
    const destination = join(outputDir, outputPath)
    mkdirSync(dirname(destination), { recursive: true })
    writeFileSync(destination, compiled)
  })
  return join(outputDir, 'lib/attribution-worker.js')
}

describe('真实 Worker Threads 归因计算', () => {
  it('完整 session 在独立线程并发，小 session 也使用线程且结果与串行一致', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'probe-x-attribution-worker-'))
    const workerPath = compileWorkerFixture(directory)
    const workers: Worker[] = []
    const pool = new AttributionWorkerPool({
      concurrency: 3,
      workerPath,
      workerFactory: filename => {
        const worker = new Worker(filename)
        workers.push(worker)
        return worker
      },
    })
    try {
      resetEventCounter()
      const events = createEvents(1503)
      // ClickHouse 也可能传回字符串时间；透传的类型必须与串行保持一致。
      events[1].$service_time = '2026-06-01T10:00:01Z' as any
      const eventLists = [events, createEvents(1), createEvents(9), createEvents(3)]
      const callbacks = eventLists.map(() => jest.fn())
      const results = await Promise.all(eventLists.map((eventList, index) => (
        pool.compute(eventList, callbacks[index])
      )))
      const result = results[0]

      expect(workers).toHaveLength(3)
      expect(new Set(workers.map(worker => worker.threadId)).size).toBe(3)
      expect(workers.every(worker => worker.threadId > 0)).toBe(true)
      expect(result.finalEvents).toBe(events)
      expect(result.attributions).toEqual(computeAttribution(events).attributions)
      expect(result.attributions.find(row => row.event_id === events[1].$event_id)?.event_time)
        .toBe('2026-06-01T10:00:01Z')
      expect(utilTypes.isDate(
        result.attributions.find(row => row.event_id === events[2].$event_id)?.event_time,
      )).toBe(true)
      results.forEach((completed, index) => {
        expect(completed.finalEvents).toBe(eventLists[index])
        expect(completed.attributions).toEqual(computeAttribution(eventLists[index]).attributions)
        const processed = callbacks[index].mock.calls.map(([value]) => value)
        expect(processed).toEqual([...processed].sort((a, b) => a - b))
        expect(callbacks[index]).toHaveBeenLastCalledWith(eventLists[index].length, eventLists[index].length)
      })

      const nextEvents = createEvents(9)
      expect((await pool.compute(nextEvents)).attributions).toEqual(computeAttribution(nextEvents).attributions)
      expect(workers).toHaveLength(3)
    } finally {
      await pool.onModuleDestroy()
      rmSync(directory, { recursive: true, force: true })
    }
  })
})
