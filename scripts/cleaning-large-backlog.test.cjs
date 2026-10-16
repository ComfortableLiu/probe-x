const assert = require('node:assert/strict')
const { test, afterEach } = require('node:test')
const { setImmediate: nextTurn } = require('node:timers/promises')
const dayjs = require('dayjs')
require('reflect-metadata')
require('ts-node').register({ transpileOnly: true, skipProject: true, compilerOptions: {
  target: 'ES2022', module: 'CommonJS', moduleResolution: 'node', experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true,
} })
const { CleaningSchedulerService } = require('../apps/data-dashboard-api-service/src/api/compute-node/cleaning-scheduler.service.ts')

const TASK_DATE = '2026-10-14'
const LARGE_BACKLOG_SIZE = 200000
const schedulers = new Set()
afterEach(() => {
  for (const scheduler of schedulers) scheduler.onModuleDestroy()
  schedulers.clear()
})
const keyOf = task => `${task.date}|${task.session_id}`
const sessionOf = index => `session-${String(index).padStart(12, '0')}`
const indexOf = session => Number(session.replace('session-', ''))
const sourceRow = (index, date = TASK_DATE) => ({
  session_id: sessionOf(index), date, service_time: `${date} 00:00:00.000`, event_name: 'page_view',
})

function deferred() {
  let resolve
  let reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

async function waitFor(condition, message = '后台扫描应推进', turns = 1000) {
  for (let turn = 0; turn < turns; turn++) {
    if (condition()) return
    await nextTurn()
  }
  assert.ok(condition(), message)
}

/** 只按当前游标生成一页；一百亿个会话也不会在测试桩中先构造全量数组。 */
function setup({ count = 100, online = true, capacity = 14, synchronous = false,
  pageSize = 16, maxBuffered = 32, beforeSource, customSource, captureTasks = true } = {}) {
  const active = new Map()
  const blocked = new Set()
  const completed = new Set()
  const taskListeners = []
  const capacityListeners = []
  const sent = []
  const sourceCalls = []
  let dispatched = 0
  let queriesInFlight = 0
  let maxQueriesInFlight = 0
  let peakBuffered = 0
  let peakPage = 0
  let finalQueries = 0
  const registry = {
    online,
    onTaskSettled(listener) { taskListeners.push(listener) },
    onCapacityAvailable(listener) { capacityListeners.push(listener) },
    hasActiveSlice(date, sessionId) {
      if (blocked.has(`${date}|${sessionId}`)) return true
      for (const task of active.values()) if (task.date === date && task.session_id === sessionId) return true
      return false
    },
    pickIdleNode() { return this.online && active.size < capacity ? 'memory-node' : null },
    dispatchTask(nodeId, task) {
      assert.equal(nodeId, 'memory-node')
      assert.ok(active.size < capacity, '不得超过节点线程容量')
      assert.equal(this.hasActiveSlice(task.date, task.session_id), false, '不得重复下发活跃切片')
      active.set(task.task_id, task)
      dispatched++
      if (captureTasks) sent.push(task)
      if (synchronous) this.settle(task.task_id)
      return true
    },
    settle(taskId, failed = false) {
      const task = active.get(taskId)
      assert.ok(task, '只能落定活跃任务')
      active.delete(taskId)
      if (!failed) completed.add(keyOf(task))
      for (const listener of taskListeners) listener(taskId, failed)
      this.wake()
    },
    wake() { for (const listener of capacityListeners) listener() },
    connect() { this.online = true; this.wake() },
  }
  const clickhouse = {
    queryBatches() { assert.fail('欠账发现必须按有界查询分页，不得打开全历史结果流') },
    async query(sql, params, settings, signal) {
      assert.ok(signal instanceof AbortSignal, '分页查询需要可取消信号')
      if (/FROM final_event_log/.test(sql)) {
        finalQueries++
        return params.candidateSlices.map(tuple => ({ date: tuple.values[0], session_id: tuple.values[1] }))
          .filter(row => completed.has(keyOf(row)))
      }
      assert.match(sql, /FROM event_log/)
      assert.match(sql, /ORDER BY/)
      assert.match(sql, /LIMIT/)
      assert.ok(params.pageSize > 0 && params.pageSize <= pageSize)
      queriesInFlight++
      maxQueriesInFlight = Math.max(maxQueriesInFlight, queriesInFlight)
      const call = { ...params, signal }
      sourceCalls.push(call)
      try {
        if (beforeSource) await beforeSource(call, sourceCalls.length)
        const start = params.afterSession ? indexOf(params.afterSession) + 1 : 0
        const rows = customSource
          ? await customSource(call, sourceCalls.length)
          : Array.from({ length: Math.min(params.pageSize, Math.max(0, count - start)) }, (_, index) => sourceRow(start + index, params.targetDate || TASK_DATE))
        peakPage = Math.max(peakPage, rows.length)
        return rows
      } finally {
        queriesInFlight--
      }
    },
  }
  const oldPageSize = process.env.CLEANING_SCAN_PAGE_SIZE
  const oldMaxBuffered = process.env.CLEANING_MAX_BUFFERED_TASKS
  let scheduler
  try {
    process.env.CLEANING_SCAN_PAGE_SIZE = String(pageSize)
    process.env.CLEANING_MAX_BUFFERED_TASKS = String(maxBuffered)
    scheduler = new CleaningSchedulerService(registry, clickhouse, {}, {})
  } finally {
    for (const [name, previous] of [['CLEANING_SCAN_PAGE_SIZE', oldPageSize], ['CLEANING_MAX_BUFFERED_TASKS', oldMaxBuffered]]) {
      if (previous === undefined) delete process.env[name]
      else process.env[name] = previous
    }
  }
  schedulers.add(scheduler)
  const enqueue = scheduler.enqueueTask.bind(scheduler)
  scheduler.enqueueTask = task => {
    const accepted = enqueue(task)
    peakBuffered = Math.max(peakBuffered, scheduler.queue.size + scheduler.inflight.size)
    return accepted
  }
  registry.onTaskSettled((taskId, failed) => scheduler.onTaskSettled(taskId, failed))
  registry.onCapacityAvailable(() => scheduler.drain())
  return { scheduler, registry, active, blocked, completed, sent, clickhouse, sourceCalls,
    get dispatched() { return dispatched }, get maxQueriesInFlight() { return maxQueriesInFlight },
    get peakBuffered() { return peakBuffered }, get peakPage() { return peakPage },
    get finalQueries() { return finalQueries } }
}

async function silently(fn) {
  const original = { log: console.log, warn: console.warn, error: console.error }
  console.log = console.warn = console.error = () => {}
  try {
    return await fn()
  } finally {
    Object.assign(console, original)
  }
}

async function expectPaused(state) {
  const calls = state.sourceCalls.length
  for (let i = 0; i < 5; i++) await nextTurn()
  assert.equal(state.sourceCalls.length, calls, '没有空闲容量时不得继续读取后续页')
}

test('百亿规模离线请求只注册扫描，重复触发合并，节点恢复后仅加载有限一页', () => silently(async () => {
  const state = setup({ count: 10000000000, online: false })
  assert.deepEqual(await state.scheduler.cleanNow(TASK_DATE), {
    dispatched: 0, pending: 0, loading: true, waitingForCapacity: true,
  })
  await state.scheduler.cleanNow(TASK_DATE)
  assert.equal(state.scheduler.scans.size, 1)
  await expectPaused(state)
  assert.equal(state.sourceCalls.length, 0)
  assert.equal(state.scheduler.queue.size, 0)
  state.registry.connect()
  await waitFor(() => state.active.size === 14)
  await expectPaused(state)
  assert.equal(state.sourceCalls.length, 1)
  assert.ok(state.peakBuffered <= 32)
  assert.ok(state.peakPage <= 16)
  assert.equal(state.scheduler.queue.size, 2)
  assert.equal(state.maxQueriesInFlight, 1)
}))

test('第二页查询挂起时首批已经下发，请求不等待全量枚举', () => silently(async () => {
  const gate = deferred()
  const state = setup({ count: 100, pageSize: 2, maxBuffered: 4, capacity: 4,
    beforeSource: async (call, number) => { if (number === 2) await gate.promise },
  })
  const response = await state.scheduler.cleanNow(TASK_DATE)
  assert.equal(response.loading, true)
  assert.equal(state.sourceCalls.length, 0, '首轮 IO 安排到请求响应之后')
  await waitFor(() => state.sourceCalls.length === 2)
  assert.equal(state.dispatched, 2, '不能等待后续页返回才派发第一页')
  assert.equal(state.active.size, 2)
  state.scheduler.onModuleDestroy()
  gate.resolve()
  await nextTurn()
  await nextTurn()
  assert.equal(state.dispatched, 2, '停止后迟到页结果不能继续派发')
}))

test('按容量暂停取页，缓冲用尽后完成任务自动续页并保持队列上限', () => silently(async () => {
  const state = setup({ count: 10000000000, pageSize: 4, maxBuffered: 4, capacity: 3 })
  await state.scheduler.cleanNow(TASK_DATE)
  await waitFor(() => state.active.size === 3)
  await expectPaused(state)
  assert.equal(state.scheduler.queue.size, 1)
  state.registry.settle([...state.active.keys()][0])
  assert.equal(state.active.size, 3, '先用已缓冲切片立即补空槽')
  await expectPaused(state)
  assert.equal(state.sourceCalls.length, 1)
  state.registry.settle([...state.active.keys()][0])
  await waitFor(() => state.sourceCalls.length === 2 && state.active.size === 3)
  await expectPaused(state)
  assert.ok(state.peakBuffered <= 4)
  assert.equal(state.maxQueriesInFlight, 1)
}))

test('并发手动和每日触发共用唯一分页生产者，来源范围覆盖时不重复派发', () => silently(async () => {
  const gate = deferred()
  const state = setup({ count: 10, capacity: 20,
    beforeSource: async (call, number) => { if (number === 1) await gate.promise },
  })
  await Promise.all(Array.from({ length: 20 }, () => state.scheduler.cleanNow(TASK_DATE)))
  await waitFor(() => state.sourceCalls.length === 1)
  await state.scheduler.cleanNow()
  await state.scheduler.cleanNow(TASK_DATE)
  assert.equal(state.maxQueriesInFlight, 1)
  assert.ok(state.scheduler.scans.size <= 2)
  gate.resolve()
  await waitFor(() => state.dispatched === 10)
  for (let i = 0; i < 10; i++) await nextTurn()
  assert.equal(state.dispatched, 10)
  assert.equal(new Set(state.sent.map(keyOf)).size, 10)
  assert.equal(state.maxQueriesInFlight, 1)
}))

test('不同日期的扫描串行推进，重叠请求不会覆盖尚未完成日期', () => silently(async () => {
  const state = setup({ count: 2, capacity: 10 })
  await Promise.all([state.scheduler.cleanNow('2026-10-12'), state.scheduler.cleanNow('2026-10-13')])
  await waitFor(() => state.dispatched === 4)
  assert.deepEqual(new Set(state.sent.map(task => task.date)), new Set(['2026-10-12', '2026-10-13']))
  assert.equal(new Set(state.sent.map(keyOf)).size, 4)
  assert.equal(state.maxQueriesInFlight, 1)
}))

test('跨日触发先完成旧游标再从头补洗，新 run 不受旧日最近切片挡住', () => silently(async () => {
  const state = setup({ count: 3, online: false, capacity: 10 })
  await state.scheduler.cleanNow(TASK_DATE)
  const scan = state.scheduler.scans.get(TASK_DATE)
  const previousRun = dayjs().subtract(1, 'day').format('YYYY-MM-DD')
  scan.range.runDate = previousRun
  const oldCursor = { serviceTime: `${TASK_DATE} 00:00:00.000`, sessionId: sessionOf(1), eventName: 'page_view' }
  scan.cursor = oldCursor
  state.scheduler.recentSlices.set(`${TASK_DATE}|${sessionOf(0)}`, previousRun)
  await state.scheduler.cleanNow(TASK_DATE)
  assert.equal(scan.cursor, oldCursor, '重复触发不能丢弃当前旧轮游标')
  assert.equal(scan.range.runDate, previousRun, '旧轮的任务标识必须保持原运行日')
  assert.equal(scan.nextRange.runDate, dayjs().format('YYYY-MM-DD'))
  state.registry.connect()
  await waitFor(() => state.dispatched === 1)
  await expectPaused(state)
  assert.equal(state.sourceCalls.length, 1, '旧轮任务未落定时不能开始新轮并跳过它')
  assert.equal(scan.waitingForTasks, true)
  state.registry.settle(state.sent[0].task_id)
  await waitFor(() => state.scheduler.scans.size === 0)
  assert.equal(state.sourceCalls[0].afterSession, sessionOf(1))
  assert.equal(state.sourceCalls[1].afterSession, undefined, '旧轮结束后必须从头补洗失败的旧切片')
  assert.equal(state.sent.length, 3)
  assert.ok(state.sent.some(task => task.session_id === sessionOf(2) && task.task_id.startsWith(`clean:${previousRun}:`)))
  assert.ok(state.sent.some(task => task.session_id === sessionOf(0) && task.task_id.startsWith(`clean:${dayjs().format('YYYY-MM-DD')}:`)))
}))

test('旧日期运行任务未落定时新全量范围等待，旧重试终止后从头补洗并释放运行计数', () => silently(async () => {
  const state = setup({ count: 3, online: false, capacity: 10 })
  const previousRun = dayjs().subtract(1, 'day').format('YYYY-MM-DD')
  const currentRun = dayjs().format('YYYY-MM-DD')
  await state.scheduler.cleanNow(TASK_DATE)
  const oldScan = state.scheduler.scans.get(TASK_DATE)
  oldScan.range.runDate = previousRun
  oldScan.cursor = { serviceTime: `${TASK_DATE} 00:00:00.000`, sessionId: sessionOf(1), eventName: 'page_view' }
  state.registry.connect()
  await waitFor(() => state.dispatched === 1 && state.scheduler.scans.size === 0)
  const oldTask = state.sent[0]
  assert.ok(oldTask.task_id.startsWith(`clean:${previousRun}:`))
  assert.equal(state.scheduler.loadedRuns.get(previousRun), 1)
  await state.scheduler.cleanNow()
  assert.ok(state.scheduler.scans.has('*'), '新全范围已接收但不能越过旧任务')
  await expectPaused(state)
  assert.equal(state.sourceCalls.length, 1)
  assert.ok(state.registry.pickIdleNode(), '存在空闲槽，暂停原因必须是跨日屏障')
  state.registry.settle(oldTask.task_id, true)
  await expectPaused(state)
  assert.equal(state.sourceCalls.length, 1)
  assert.equal(state.scheduler.loadedRuns.get(previousRun), 1, '重试保留同一个运行占用')
  state.registry.settle(`${oldTask.task_id}:r1`, true)
  await expectPaused(state)
  assert.equal(state.sourceCalls.length, 1)
  state.registry.settle(`${oldTask.task_id}:r2`, true)
  await waitFor(() => state.sourceCalls.length === 2 && state.active.size === 3)
  assert.equal(state.sourceCalls[1].afterSession, undefined, '新全范围必须从头发现旧日失败切片')
  assert.equal(state.scheduler.loadedRuns.has(previousRun), false)
  assert.equal(state.scheduler.loadedRuns.get(currentRun), 3)
  const newTasks = state.sent.filter(task => task.task_id.startsWith(`clean:${currentRun}:`))
  assert.equal(newTasks.length, 3)
  assert.ok(newTasks.some(task => task.session_id === oldTask.session_id), '旧轮最终失败切片不能被新游标漏掉')
  for (const task of newTasks) state.registry.settle(task.task_id)
  await waitFor(() => state.scheduler.scans.size === 0)
  assert.equal(state.scheduler.loadedRuns.size, 0)
  assert.equal(state.scheduler.queue.size, 0)
  assert.equal(state.scheduler.inflight.size, 0)
  assert.equal(state.scheduler.attempts.size, 0)
  assert.equal(state.scheduler.retryBases.size, 0)
}))

test('跨页重复切片、跨日旧队列及节点恢复占用均保持去重', () => silently(async () => {
  const state = setup({ capacity: 10, pageSize: 2, maxBuffered: 4, customSource: async (params, number) => {
    if (number === 1) return [sourceRow(0), { ...sourceRow(1), session_id: sessionOf(0) }]
    if (number === 2) return [sourceRow(2), { ...sourceRow(3), session_id: sessionOf(0) }]
    return []
  } })
  const old = { task_id: `clean:2026-10-14:${TASK_DATE}:${sessionOf(0)}`, date: TASK_DATE, session_id: sessionOf(0) }
  state.scheduler.enqueueTask(old)
  state.blocked.add(`${TASK_DATE}|${sessionOf(2)}`)
  await state.scheduler.cleanNow(TASK_DATE)
  await expectPaused(state)
  assert.equal(state.sourceCalls.length, 0, '新运行等跨日旧任务落定后才读取')
  assert.deepEqual(state.sent.map(task => task.task_id), [old.task_id])
  state.registry.settle(old.task_id)
  await waitFor(() => state.sourceCalls.length === 3)
  assert.deepEqual(state.sent.map(task => task.task_id), [old.task_id])
  assert.equal(state.scheduler.queue.size, 0)
}))

for (const failure of ['false', 'throw']) {
  test(`发送${failure === 'false' ? '返回失败' : '抛错'}保留已加载页的任务并释放所有预占`, () => silently(async () => {
    const state = setup({ count: 3, capacity: 1 })
    const dispatch = state.registry.dispatchTask
    state.registry.dispatchTask = () => {
      if (failure === 'throw') throw new Error('channel write failed')
      return false
    }
    await state.scheduler.cleanNow(TASK_DATE)
    await waitFor(() => state.scheduler.queue.size === 3)
    assert.equal(state.scheduler.inflight.size, 0)
    assert.equal(state.scheduler.dispatchedTasks.size, 0)
    state.registry.dispatchTask = dispatch
    state.scheduler.drain()
    assert.equal(state.dispatched, 1)
    assert.equal(state.scheduler.queue.size, 2)
  }))
}

test('中途页查询失败保留原游标与已下发任务，恢复后重试同页', () => silently(async () => {
  let fail = true
  const state = setup({ count: 4, pageSize: 2, maxBuffered: 4, capacity: 10,
    beforeSource: async (call, number) => { if (number === 2 && fail) throw new Error('page interrupted') },
  })
  await state.scheduler.cleanNow(TASK_DATE)
  await waitFor(() => state.sourceCalls.length === 2)
  assert.equal(state.dispatched, 2)
  assert.equal(state.scheduler.scans.size, 1)
  await nextTurn()
  await nextTurn()
  assert.equal(state.sourceCalls.length, 2, '失败页不能进入紧密重试循环')
  fail = false
  state.scheduler.resumeScans()
  await waitFor(() => state.dispatched === 4)
  assert.equal(state.sourceCalls[2].afterTime, state.sourceCalls[1].afterTime)
  assert.equal(state.sourceCalls[2].afterSession, state.sourceCalls[1].afterSession)
  assert.equal(new Set(state.sent.map(keyOf)).size, 4)
}))

test('候选最终表查询失败不推进源游标，恢复后从同一页重新发现', () => silently(async () => {
  const state = setup({ count: 3, capacity: 10 })
  const query = state.clickhouse.query
  let fail = true
  state.clickhouse.query = async (...args) => {
    if (/FROM final_event_log/.test(args[0]) && fail) throw new Error('candidate lookup unavailable')
    return query(...args)
  }
  await state.scheduler.cleanNow(TASK_DATE)
  await waitFor(() => state.scheduler.scans.get(TASK_DATE)?.failed)
  assert.equal(state.dispatched, 0)
  assert.equal(state.scheduler.scans.get(TASK_DATE).cursor, null)
  fail = false
  state.scheduler.resumeScans()
  await waitFor(() => state.dispatched === 3)
  assert.equal(state.sourceCalls.length, 2)
  assert.equal(state.sourceCalls[1].afterSession, undefined)
  assert.equal(state.scheduler.scans.size, 0)
}))

test('缓冲上限包含在途任务，失败重试不会扩大已加载任务集合', () => silently(async () => {
  const state = setup({ count: 100, pageSize: 16, maxBuffered: 10, capacity: 14 })
  await state.scheduler.cleanNow(TASK_DATE)
  await waitFor(() => state.active.size === 10)
  await expectPaused(state)
  assert.equal(state.sourceCalls[0].pageSize, 10)
  assert.equal(state.scheduler.queue.size, 0)
  const first = state.sent[0]
  state.registry.settle(first.task_id, true)
  assert.equal(state.active.size, 10)
  state.registry.settle(`${first.task_id}:r1`, true)
  assert.equal(state.active.size, 10)
  assert.equal(state.sourceCalls.length, 1, '重试占据原任务预留容量，不额外读取')
  state.registry.settle(`${first.task_id}:r2`, true)
  await waitFor(() => state.sourceCalls.length === 2 && state.active.size === 10)
  assert.ok(state.peakBuffered <= 10)
  assert.equal(state.scheduler.attempts.size, 0, '最终放弃后释放重试历史')
  assert.equal(state.scheduler.retryBases.size, 0)
}))

test('每日触发在全部分页和在途任务结束后才写执行标记，繁忙 tick 不重复注册', () => silently(async () => {
  const state = setup({ count: 5, pageSize: 2, maxBuffered: 4, capacity: 2 })
  const writes = []
  state.scheduler.redisService = {
    get: async () => writes.at(-1)?.[1] || null,
    set: async (...args) => { writes.push(args) },
  }
  state.scheduler.configRepo = { find: async () => [
    { key: 'final_cleaning.enabled', value: 'true' },
    { key: 'final_cleaning.daily_time', value: '00:00' },
  ] }
  await state.scheduler.tick()
  await waitFor(() => state.dispatched === 2)
  assert.equal(writes.length, 0)
  const initialCalls = state.sourceCalls.length
  await state.scheduler.tick()
  await state.scheduler.tick()
  await expectPaused(state)
  assert.equal(state.sourceCalls.length, initialCalls)
  while (state.completed.size < 5) {
    await waitFor(() => state.active.size > 0)
    assert.equal(writes.length, 0, '任务仍在途时不能提前消耗每日额度')
    state.registry.settle(state.active.keys().next().value)
  }
  await waitFor(() => writes.length === 1)
  assert.deepEqual(writes[0], ['clean:scheduler:last_run_date', dayjs().format('YYYY-MM-DD'), 86400 * 3])
  assert.equal(state.scheduler.scans.size, 0)
  await state.scheduler.tick()
  await nextTurn()
  assert.equal(writes.length, 1)
  assert.equal(state.dispatched, 5)
}))

test('关闭取消挂起查询，忽略迟到响应，之后不再查询或派发', () => silently(async () => {
  const gate = deferred()
  const state = setup({ beforeSource: async () => { await gate.promise } })
  await state.scheduler.cleanNow(TASK_DATE)
  await waitFor(() => state.sourceCalls.length === 1)
  const signal = state.sourceCalls[0].signal
  assert.equal(signal.aborted, false)
  state.scheduler.onModuleDestroy()
  assert.equal(signal.aborted, true)
  gate.resolve()
  for (let i = 0; i < 5; i++) await nextTurn()
  assert.equal(state.sourceCalls.length, 1)
  assert.equal(state.finalQueries, 0, '源查询迟到后不能开始新的候选查重请求')
  assert.equal(state.dispatched, 0)
  assert.equal(state.scheduler.queue.size, 0)
  assert.equal(state.scheduler.inflight.size, 0)
}))

test('20 万会话逐页发现与同步完成仍让出事件循环，全部结束后运行状态有界且清空', () => silently(async () => {
  const state = setup({ count: LARGE_BACKLOG_SIZE, synchronous: true, capacity: 1,
    pageSize: 256, maxBuffered: 512, captureTasks: false,
  })
  await state.scheduler.cleanNow(TASK_DATE)
  assert.equal(state.dispatched, 0)
  await nextTurn()
  assert.ok(state.dispatched > 0 && state.dispatched < LARGE_BACKLOG_SIZE, '不能一个事件循环扫完所有数据')
  let turns = 0
  while (state.dispatched < LARGE_BACKLOG_SIZE || state.scheduler.scans.size > 0) {
    assert.ok(turns++ < 10000, '扫描应在有限页数内完成')
    await nextTurn()
  }
  assert.equal(state.dispatched, LARGE_BACKLOG_SIZE)
  assert.ok(state.sourceCalls.length > 100)
  assert.ok(state.peakBuffered <= 512)
  assert.ok(state.peakPage <= 256)
  assert.equal(state.maxQueriesInFlight, 1)
  assert.equal(state.active.size, 0)
  assert.equal(state.scheduler.queue.size, 0)
  assert.equal(state.scheduler.inflight.size, 0)
  assert.equal(state.scheduler.dispatchedTasks.size, 0)
  assert.equal(state.scheduler.retryBases.size, 0)
  assert.equal(state.scheduler.attempts.size, 0)
  assert.equal(state.scheduler.loadedRuns.size, 0)
  assert.ok(state.scheduler.recentSlices.size <= 10000)
}))
