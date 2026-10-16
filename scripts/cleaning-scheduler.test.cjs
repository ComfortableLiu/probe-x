const assert = require('node:assert/strict')
const { test, afterEach } = require('node:test')
const { setImmediate: nextTurn } = require('node:timers/promises')
const dayjs = require('dayjs')
require('reflect-metadata')
require('ts-node').register({ transpileOnly: true, skipProject: true, compilerOptions: {
  target: 'ES2022', module: 'CommonJS', moduleResolution: 'node', experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true,
} })
const { buildTaskId, planCleaningTasks, CleaningSchedulerService } = require('../apps/data-dashboard-api-service/src/api/compute-node/cleaning-scheduler.service.ts')
const { NodeRegistryService } = require('../apps/data-dashboard-api-service/src/api/compute-node/node-registry.service.ts')

const schedulers = new Set()
afterEach(() => {
  for (const scheduler of schedulers) scheduler.onModuleDestroy()
  schedulers.clear()
})

function createScheduler(...dependencies) {
  const scheduler = new CleaningSchedulerService(...dependencies)
  schedulers.add(scheduler)
  return scheduler
}

async function waitFor(condition, message = '后台清洗扫描应推进', turns = 100) {
  for (let turn = 0; turn < turns; turn++) {
    if (condition()) return
    await nextTurn()
  }
  assert.ok(condition(), message)
}

/** 小数据 IO 桩遵循真实 reader 的物理键分页，最终表返回未清洗。 */
function backlogClickhouse(rows = []) {
  const source = rows.map((row, index) => ({
    ...row,
    service_time: new Date(Date.parse(`${row.date}T00:00:00.000Z`) + index).toISOString().replace('T', ' ').replace('Z', ''),
    event_name: `event-${index}`,
  })).sort((left, right) => tupleOf(left).localeCompare(tupleOf(right)))
  return {
    async query(sql, params) {
      if (/FROM final_event_log/.test(sql)) return []
      assert.match(sql, /FROM event_log/)
      return source.filter(row => (!params.targetDate || row.date === params.targetDate)
        && row.date <= params.throughDate
        && (!params.afterTime || tupleOf(row) > [params.afterTime, params.afterSession, params.afterEvent].join('|')))
        .slice(0, params.pageSize)
    },
  }
}

function tupleOf(row) {
  return [row.service_time, row.session_id, row.event_name].join('|')
}

async function loadFirstPage(scheduler, date = '2026-09-28') {
  await scheduler.cleanNow(date)
  await nextTurn()
  await nextTurn()
}

function bufferRows(scheduler, rows) {
  for (const row of rows) scheduler.enqueueTask({
    ...row,
    task_id: buildTaskId(dayjs().format('YYYY-MM-DD'), row.date, row.session_id),
  })
}

test('task_id 确定性生成，重试追加 :r{n} 后缀', () => {
  assert.equal(buildTaskId('2026-09-29', '2026-09-28', 's-1'), 'clean:2026-09-29:2026-09-28:s-1')
  assert.equal(buildTaskId('2026-09-29', '2026-09-28', 's-1', 2), 'clean:2026-09-29:2026-09-28:s-1:r2')
})

test('planCleaningTasks 为每个 (date, session) 生成任务并去重', () => {
  const rows = [
    { session_id: 's-1', date: '2026-09-28' },
    { session_id: 's-2', date: '2026-09-28' },
    { session_id: 's-1', date: '2026-09-28' },
  ]
  const tasks = planCleaningTasks(rows, '2026-09-29')
  assert.equal(tasks.length, 2)
  assert.deepEqual(tasks[0], { task_id: 'clean:2026-09-29:2026-09-28:s-1', session_id: 's-1', date: '2026-09-28' })
})

/** 最小桩构造调度器：只补当前用例触及的依赖方法，私有成员按 JS 语义直接访问 */
function stubScheduler({ rows = [], idle = true } = {}) {
  const dispatched = []
  const registry = {
    onTaskSettled() {},
    onCapacityAvailable() {},
    hasActiveSlice() { return false },
    pickIdleNode() { return idle ? 'node-1' : null },
    dispatchTask(nodeId, task) { dispatched.push(task.task_id); return true },
  }
  const clickhouse = backlogClickhouse(rows)
  const scheduler = createScheduler(registry, clickhouse, {}, {})
  return { scheduler, dispatched, registry }
}

test('连续失败时重试 task_id 按 :r1、:r2 递增，超过上限后放弃', () => {
  const { scheduler, dispatched } = stubScheduler()
  const base = 'clean:2026-09-29:2026-09-28:s-1'
  scheduler.enqueueTask({ task_id: base, session_id: 's-1', date: '2026-09-28' })
  scheduler.drain()
  scheduler.onTaskSettled(base, true)
  scheduler.onTaskSettled(`${base}:r1`, true)
  scheduler.onTaskSettled(`${base}:r2`, true)
  assert.deepEqual(dispatched, [base, `${base}:r1`, `${base}:r2`])
  assert.equal(scheduler.queue.size, 0)
})

test('同一 (date, session) 在队列积压或任务在途时不重复入队', async () => {
  const rows = [
    { session_id: 's-old', date: '2026-09-28' },
    { session_id: 's-fly', date: '2026-09-28' },
  ]
  const { scheduler, dispatched, registry } = stubScheduler({ rows, idle: false })
  // 场景 a：节点全天离线，队列里积压着昨日 runDate 的旧任务；换天后同一切片不得重复入队，旧任务保留
  scheduler.enqueueTask({ task_id: 'clean:2026-09-28:2026-09-28:s-old', session_id: 's-old', date: '2026-09-28' })
  scheduler.enqueueBacklog()
  bufferRows(scheduler, rows)
  assert.equal([...scheduler.queue.values()].filter(task => task.session_id === 's-old').length, 1)
  assert.equal(scheduler.queue.values().next().value.task_id, 'clean:2026-09-28:2026-09-28:s-old')
  // 场景 b：s-fly 下发在途（final_event_log 尚未写入），cleanNow 重新枚举到也不得重发
  registry.pickIdleNode = () => 'node-1'
  scheduler.drain()
  assert.equal(dispatched.length, 2)
  scheduler.enqueueBacklog()
  await nextTurn()
  await nextTurn()
  assert.equal(scheduler.queue.size, 0)
  assert.equal(dispatched.filter(id => id.includes('s-fly')).length, 1)
})

/**
 * 真实 NodeRegistryService + 真实 CleaningSchedulerService，桩只落在 IO 边界
 * （computeNodeService 写库、ClickHouse 查询、心跳超时配置）。
 * settle 监听手工接线（与 scheduler.onModuleInit 第一行相同），避免拉起 60s 定时器拖住测试进程。
 */
function stubWiredPair({ rows = [], heartbeatTimeoutMs = 15000 } = {}) {
  const computeNodeService = {
    upsertFromRegister: async () => {},
    syncStatus: async () => {},
    listRegistered: async () => [],
  }
  const configService = { get: key => key === 'nodeControl.heartbeatTimeoutMs' ? heartbeatTimeoutMs : undefined }
  const registry = new NodeRegistryService(computeNodeService, configService)
  const scheduler = createScheduler(registry, backlogClickhouse(rows), {}, {})
  registry.onTaskSettled((taskId, failed) => scheduler.onTaskSettled(taskId, failed))
  registry.onCapacityAvailable(() => scheduler.drain())
  return { registry, scheduler }
}

/** 接入一个在线节点，返回会话与上行帧入口 */
function connectNode(registry, nodeId = 'node-1', info = {}) {
  const session = { frames: [], send(frame) { this.frames.push(frame) }, close() {} }
  const handle = registry.openSession(session)
  handle.onFrame({ register: {
    node_id: nodeId, node_name: nodeId, node_address: '', version: '1',
    info: { cpu_count: 1, memory_size: 1024, available_memory_size: 512, available: true, busy: false, busy_task_id: '', ...info },
  } })
  return { session, handle }
}

/** 枚举一条欠账并下发到已接入节点，返回已下发任务的 task_id */
async function dispatchOne(registry, scheduler, session) {
  scheduler.enqueueBacklog()
  scheduler.drain()
  await waitFor(() => session.frames.some(frame => frame.task), '首批任务应已下发到节点')
  const frame = session.frames.find(f => f.task)
  assert.ok(frame, '任务应已下发到节点')
  assert.equal(scheduler.inflight.size, 1)
  return frame.task.task_id
}

test('节点心跳超时死亡时在途任务按失败落定：inflight 释放并以 :r1 重入队，重复扫描不重复通知', async () => {
  const rows = [{ session_id: 's-1', date: '2026-09-28' }]
  const { registry, scheduler } = stubWiredPair({ rows })
  const { session } = connectNode(registry)
  const taskId = await dispatchOne(registry, scheduler, session)

  let settleNotifications = 0
  registry.onTaskSettled(() => { settleNotifications++ })
  // 分页 IO 是异步的，直接推进最后心跳避免依赖机器毫秒级时序。
  registry.nodes.get('node-1').lastHeartbeat = Date.now() - 15001
  await registry.reconcileStatus()
  await registry.reconcileStatus()

  assert.equal(settleNotifications, 1)
  assert.equal(scheduler.inflight.size, 0)
  assert.equal(scheduler.queue.size, 1)
  assert.equal(scheduler.queue.values().next().value.task_id, `${taskId}:r1`)
})

test('节点断流（detach 已置离线，不走 persistedStatus 跳变）时在途任务同样按失败落定', async () => {
  const rows = [{ session_id: 's-1', date: '2026-09-28' }]
  const { registry, scheduler } = stubWiredPair({ rows })
  const { session, handle } = connectNode(registry)
  const taskId = await dispatchOne(registry, scheduler, session)

  handle.onClose('测试断流')
  await registry.reconcileStatus()

  assert.equal(scheduler.inflight.size, 0)
  assert.equal(scheduler.queue.size, 1)
  assert.equal(scheduler.queue.values().next().value.task_id, `${taskId}:r1`)
})

test('cleanNow 拒绝非法格式与今天/未来日期，过去日期正常触发', async () => {
  const { scheduler } = stubScheduler()
  await assert.rejects(scheduler.cleanNow('not-a-date'), /格式非法/)
  await assert.rejects(scheduler.cleanNow('2026-9-8'), /格式非法/)
  await assert.rejects(scheduler.cleanNow('2026-02-30'), /日期|非法|有效/)
  await assert.rejects(scheduler.cleanNow(dayjs().format('YYYY-MM-DD')), /今天以前/)
  await assert.rejects(scheduler.cleanNow('2999-01-01'), /今天以前/)
  // 合法过去日期立即注册扫描，不等待首轮 IO。
  assert.deepEqual(await scheduler.cleanNow('2026-09-28'), { dispatched: 0, pending: 0, loading: true, waitingForCapacity: false })
})

test('tick 分页失败不消耗当天额度，下一次 tick 恢复后才写入', async () => {
  const writes = []
  const redis = { get: async () => null, set: async (...args) => { writes.push(args) } }
  const configRepo = {
    find: async () => [
      { key: 'final_cleaning.enabled', value: 'true' },
      { key: 'final_cleaning.daily_time', value: '00:00' },
    ],
  }
  const registry = {
    onTaskSettled() {}, onCapacityAvailable() {}, hasActiveSlice: () => false,
    pickIdleNode: () => 'node-1', dispatchTask: () => true,
  }
  let queries = 0
  const clickhouse = { async query() { queries++; throw new Error('ClickHouse 挂了') } }
  const scheduler = createScheduler(registry, clickhouse, redis, configRepo)
  const previousError = console.error
  console.error = () => {}
  try {
    await scheduler.tick()
    await waitFor(() => queries === 1)
    assert.equal(writes.length, 0)
    assert.equal(scheduler.scans.size, 1, '失败范围仍保留供下轮恢复')
    clickhouse.query = async () => []
    await scheduler.tick()
    await waitFor(() => writes.length === 1, '恢复后完整扫描才记录每日执行额度')
    assert.equal(writes[0][0], 'clean:scheduler:last_run_date')
  } finally {
    console.error = previousError
  }
})

test('非 clean: 前缀的落定通知被直接忽略', () => {
  const { scheduler } = stubScheduler()
  scheduler.onTaskSettled('some-future-task-type:1', true)
  scheduler.onTaskSettled('some-future-task-type:1', false)
  assert.equal(scheduler.queue.size, 0)
  assert.equal(scheduler.attempts.size, 0)
})

const { metricsWindow, metricsKey, nodeCleaningMetricsKey } = require('../libs/shared-utils/src/lib/backend-common/runtime-metrics.ts')

/** 带原子 eval 与 multi 的内存 Redis 桩，覆盖速度统计用到的命令 */
function memoryRedis() {
  const data = new Map()
  return {
    status: 'ready',
    data,
    async eval(script, numberOfKeys, key, eventsRaw, durationRaw) {
      assert.equal(numberOfKeys, 1)
      assert.match(script, /redis\.call\('HINCRBY', KEYS\[1\], 'samples', 1\)/)
      assert.match(script, /redis\.call\('HINCRBYFLOAT', KEYS\[1\], 'events', ARGV\[1\]\)/)
      assert.match(script, /redis\.call\('EXPIRE', KEYS\[1\], ARGV\[3\]\)/)
      const row = data.get(key) || {}
      const events = Number(eventsRaw)
      const durationMs = Number(durationRaw)
      const speed = events * 1000 / durationMs
      row.samples = String(Number(row.samples || 0) + 1)
      row.events = String(Number(row.events || 0) + events)
      row.durationMs = String(Number(row.durationMs || 0) + durationMs)
      if (row.maxSpeed === undefined || speed > Number(row.maxSpeed)) row.maxSpeed = String(speed)
      if (row.minSpeed === undefined || speed < Number(row.minSpeed)) row.minSpeed = String(speed)
      data.set(key, row)
      return 1
    },
    hset: async (key, field, value) => {
      const row = data.get(key) || {}
      row[field] = String(value)
      data.set(key, row)
      return 1
    },
    multi() {
      const operations = []
      const tx = {}
      for (const command of ['hsetnx', 'hincrby', 'hincrbyfloat', 'expire', 'hgetall', 'hget', 'hset']) {
        tx[command] = (key, field, value) => {
          operations.push(() => {
            const row = data.get(key) || {}
            if (command === 'hgetall') return { ...row }
            if (command === 'hget') return row[field] ?? null
            if (command === 'expire') return 1
            if (command === 'hset') { row[field] = String(value) }
            else if (command === 'hsetnx') { if (!(field in row)) row[field] = String(value) }
            else row[field] = String(Number(row[field] || 0) + value)
            data.set(key, row)
            return 1
          })
          return tx
        }
      }
      tx.exec = async () => operations.map(op => [null, op()])
      return tx
    },
  }
}

const drainMetrics = () => new Promise(resolve => setImmediate(resolve))

/**
 * node:test 的上报帧与用例里的 console 输出交错时可能损坏父进程解析（nodejs/node#64061），
 * 用例内静默 console，不影响断言
 */
async function withSilentConsole(fn) {
  const originalLog = console.log
  const originalWarn = console.warn
  console.log = () => {}
  console.warn = () => {}
  try {
    return await fn()
  } finally {
    console.log = originalLog
    console.warn = originalWarn
  }
}

/** 真实 registry + 内存 Redis 的接线，进度帧入口由 connectNode 返回 */
function stubRegistryWithRedis() {
  const redis = memoryRedis()
  const computeNodeService = {
    upsertFromRegister: async () => {},
    syncStatus: async () => {},
    listRegistered: async () => [],
  }
  const configService = { get: () => undefined }
  const registry = new NodeRegistryService(computeNodeService, configService, { getClient: () => redis })
  return { registry, redis }
}

const progressFrame = (taskId, overrides = {}) => ({ progress: {
  task_id: taskId, node_id: 'node-1', target: 100, progress: 100,
  message: '', completed: false, failed: false, error: '', ...overrides,
} })

async function withClock(fn) {
  const originalNow = Date.now
  let now = Date.parse('2026-10-15T00:00:00Z')
  Date.now = () => now
  try {
    return await fn({
      advance: ms => { now += ms },
      set: value => { now = typeof value === 'number' ? value : Date.parse(value) },
      now: () => now,
    })
  } finally {
    Date.now = originalNow
  }
}

test('节点忙碌区间记录总速度，幂等重放不计量，失败仅保留已观察进度', () => withSilentConsole(() => withClock(async clock => {
  const rows = [{ session_id: 's-1', date: '2026-09-28' }]
  const { registry, redis } = stubRegistryWithRedis()
  const scheduler = createScheduler(registry, backlogClickhouse(rows), {}, {})
  registry.onTaskSettled((taskId, failed) => scheduler.onTaskSettled(taskId, failed))
  const { session, handle } = connectNode(registry)
  const taskId = await dispatchOne(registry, scheduler, session)
  const day = metricsWindow().today
  const nodeKey = nodeCleaningMetricsKey('node-1', day)

  // 幂等重放的完成帧（target:0）不产生任何统计
  handle.onFrame(progressFrame(taskId, { target: 0, progress: 0, completed: true }))
  await drainMetrics()
  assert.equal(redis.data.has(nodeKey), false)

  // 重新下发后真实完成：写入节点速度与 session 分钟桶
  bufferRows(scheduler, [{ session_id: 's-real', date: '2026-09-28' }])
  scheduler.drain()
  const retryTaskId = session.frames.at(-1).task.task_id
  clock.advance(5000)
  handle.onFrame(progressFrame(retryTaskId, { completed: true }))
  await drainMetrics()
  await drainMetrics()
  const nodeRow = redis.data.get(nodeKey)
  assert.equal(nodeRow.samples, '1')
  assert.equal(nodeRow.events, '100')
  assert.equal(nodeRow.durationMs, '5000')
  assert.equal(Number(nodeRow.maxSpeed), 20)
  assert.equal(nodeRow.minSpeed, nodeRow.maxSpeed)
  const processingRow = redis.data.get(metricsKey('processing', day))
  const sessionBuckets = Object.keys(processingRow).filter(key => key.startsWith('sessionMinute:'))
  assert.equal(sessionBuckets.length, 1)
  assert.equal(processingRow[sessionBuckets[0]], '1')

  // 失败不补剩余 60 个事件；此前已观察到的 40 个事件仍是真实处理工作。
  bufferRows(scheduler, [{ session_id: 's-failed', date: '2026-09-28' }])
  scheduler.drain()
  const failedTaskId = session.frames.at(-1).task.task_id
  clock.advance(500)
  handle.onFrame(progressFrame(failedTaskId, { progress: 40 }))
  clock.advance(500)
  handle.onFrame(progressFrame(failedTaskId, { progress: 100, failed: true, error: 'boom' }))
  // 失败会被调度器同步补位，节点仍忙碌，由定时采样结算该区间。
  registry.sampleTotalSpeeds(clock.now())
  await drainMetrics()
  assert.equal(redis.data.get(nodeKey).samples, '2')
  assert.equal(redis.data.get(nodeKey).events, '140')
  assert.equal(redis.data.get(nodeKey).durationMs, '6000')
  assert.equal(processingRow[sessionBuckets[0]], '1')
})))

test('长 session 实时速度累计新增处理进度，任务结束后归 null 且保留今日统计', () => withSilentConsole(() => withClock(async clock => {
  const rows = [{ session_id: 's-1', date: '2026-09-28' }]
  const { registry } = stubRegistryWithRedis()
  const scheduler = createScheduler(registry, backlogClickhouse(rows), {}, {})
  registry.onTaskSettled((taskId, failed) => scheduler.onTaskSettled(taskId, failed))
  const { session, handle } = connectNode(registry)
  const taskId = await dispatchOne(registry, scheduler, session)

  // 忙碌但尚无处理事件时显示真实 0。
  let topology = await registry.getTopology()
  assert.equal(topology.nodes[0].cleaningSpeed.current, 0)
  clock.advance(1000)
  handle.onFrame(progressFrame(taskId, { progress: 40 }))
  registry.sampleTotalSpeeds(clock.now())
  assert.equal((await registry.getTopology()).nodes[0].cleaningSpeed.current, 40)
  clock.advance(1000)
  handle.onFrame(progressFrame(taskId, { progress: 100 }))
  registry.sampleTotalSpeeds(clock.now())
  const node = registry.nodes.get('node-1')
  topology = await registry.getTopology()
  assert.equal(topology.nodes[0].cleaningSpeed.current, 50)

  // 任务完成后实时速度归 null，今日统计可读
  handle.onFrame(progressFrame(taskId, { completed: true }))
  await drainMetrics()
  await drainMetrics()
  topology = await registry.getTopology()
  assert.equal(topology.nodes[0].busy, false)
  assert.equal(topology.nodes[0].cleaningSpeed.current, null)
  assert.equal(node.speedBuckets.length, 0)
  const { avg, max, min } = topology.nodes[0].cleaningSpeed
  assert.equal(avg, 50)
  assert.equal(max, 60)
  assert.equal(min, 40)
})))

const backlogRows = count => Array.from({ length: count }, (_, i) => ({
  session_id: `s-capacity-${i}`, date: '2026-09-28',
}))
const sentTasks = session => session.frames.filter(frame => frame.task).map(frame => frame.task)
const heartbeatFrame = (taskCapacity, activeTaskIds = []) => ({ register: {
  node_id: 'node-1', node_name: 'node-1', node_address: '', version: '1',
  info: {
    cpu_count: 4, memory_size: 1024, available_memory_size: 512, available: true,
    busy: activeTaskIds.length > 0, busy_task_id: activeTaskIds[0] || '',
    task_capacity: taskCapacity, active_task_ids: activeTaskIds,
  },
} })

test('一个节点按容量填满多个 session，完成一个仅释放一个槽并立即补位', () => withSilentConsole(async () => {
  const { registry, scheduler } = stubWiredPair({ rows: backlogRows(5), heartbeatTimeoutMs: 15000 })
  const { session, handle } = connectNode(registry, 'node-1', { task_capacity: 3 })
  await loadFirstPage(scheduler)
  const initial = sentTasks(session)
  assert.equal(initial.length, 3)
  assert.equal(scheduler.queue.size, 2)
  assert.equal(scheduler.inflight.size, 3)
  assert.equal(registry.pickIdleNode(), null)
  const node = registry.nodes.get('node-1')
  const first = node.activeTasks.get(initial[0].task_id)
  const third = node.activeTasks.get(initial[2].task_id)

  handle.onFrame(progressFrame(initial[1].task_id, { completed: true }))
  assert.equal(sentTasks(session).length, 4)
  assert.equal(scheduler.queue.size, 1)
  assert.equal(scheduler.inflight.size, 3)
  assert.equal(node.activeTasks.size, 3)
  assert.equal(node.activeTasks.get(initial[0].task_id), first)
  assert.equal(node.activeTasks.get(initial[2].task_id), third)
  const topology = await registry.getTopology()
  assert.equal(topology.nodes[0].taskCapacity, 3)
  assert.equal(topology.nodes[0].activeTaskCount, 3)
  assert.deepEqual(topology.nodes[0].busyTaskIds, [...node.activeTasks.keys()])
  assert.equal(topology.nodes[0].busyTaskId, initial[0].task_id)
}))

test('一个任务失败只重试该任务，其余任务占用和进度保持不变', () => withSilentConsole(async () => {
  const { registry, scheduler } = stubWiredPair({ rows: backlogRows(3), heartbeatTimeoutMs: 15000 })
  const { session, handle } = connectNode(registry, 'node-1', { task_capacity: 3 })
  await loadFirstPage(scheduler)
  const initial = sentTasks(session)
  handle.onFrame(progressFrame(initial[0].task_id, { progress: 40 }))
  const first = registry.nodes.get('node-1').activeTasks.get(initial[0].task_id)
  handle.onFrame(progressFrame(initial[1].task_id, { progress: 0, failed: true, error: 'boom' }))
  const active = registry.nodes.get('node-1').activeTasks
  assert.equal(active.size, 3)
  assert.equal(active.get(initial[0].task_id), first)
  assert.equal(first.lastProgress.progress, 40)
  assert.equal(active.has(initial[2].task_id), true)
  assert.equal(active.has(initial[1].task_id), false)
  assert.equal(active.has(`${initial[1].task_id}:r1`), true)
  assert.equal(scheduler.inflight.size, 3)
  assert.equal(sentTasks(session).length, 4)
}))

test('未知或重复进度、旧流迟到帧均不释放其他任务或重复落定', () => withSilentConsole(async () => {
  const { registry, scheduler } = stubWiredPair({ rows: backlogRows(3), heartbeatTimeoutMs: 15000 })
  const { session, handle } = connectNode(registry, 'node-1', { task_capacity: 2 })
  await loadFirstPage(scheduler)
  const [first, second] = sentTasks(session)
  const settled = []
  registry.onTaskSettled((...args) => settled.push(args))
  handle.onFrame(progressFrame('clean:2026-10-14:2026-09-28:unknown', { completed: true }))
  handle.onFrame(progressFrame('unknown-running', { progress: 20 }))
  assert.equal(registry.nodes.get('node-1').activeTasks.size, 2)
  assert.equal(settled.length, 0)
  handle.onFrame(progressFrame(first.task_id, { completed: true }))
  handle.onFrame(progressFrame(first.task_id, { completed: true }))
  handle.onFrame(progressFrame(first.task_id, { failed: true, error: 'late failure' }))
  assert.equal(settled.length, 1)
  assert.equal(scheduler.inflight.size, 2)

  const replacement = connectNode(registry, 'node-1', {
    task_capacity: 2, active_task_ids: [...registry.nodes.get('node-1').activeTasks.keys()],
  })
  handle.onFrame(progressFrame(second.task_id, { completed: true }))
  handle.onFrame(heartbeatFrame(9))
  handle.onClose('旧流关闭')
  assert.equal(registry.nodes.get('node-1').activeTasks.size, 2)
  assert.equal(registry.nodes.get('node-1').info.task_capacity, 2)
  assert.equal(settled.length, 1)
  replacement.handle.onFrame(progressFrame(second.task_id, { completed: true }))
  assert.equal(settled.length, 2)
  assert.equal(registry.nodes.get('node-1').activeTasks.size, 1)
}))

test('多任务节点离线后全部各落定一次，重复巡检不重复重试', () => withSilentConsole(async () => {
  const { registry, scheduler } = stubWiredPair({ rows: backlogRows(3), heartbeatTimeoutMs: 15000 })
  const { session, handle } = connectNode(registry, 'node-1', { task_capacity: 3 })
  await loadFirstPage(scheduler)
  const initial = sentTasks(session)
  const settled = []
  registry.onTaskSettled((...args) => settled.push(args))
  handle.onClose('断开')
  await registry.reconcileStatus()
  await registry.reconcileStatus()
  assert.equal(registry.nodes.get('node-1').activeTasks.size, 0)
  assert.equal(scheduler.inflight.size, 0)
  assert.equal(scheduler.queue.size, 3)
  assert.deepEqual(settled, initial.map(task => [task.task_id, true]))
  assert.deepEqual([...scheduler.queue.values()].map(task => task.task_id), initial.map(task => `${task.task_id}:r1`))
}))

test('未上报容量和容量为 0 的旧节点默认只能接收一个任务', () => withSilentConsole(async () => {
  for (const info of [{}, { task_capacity: 0 }]) {
    const { registry, scheduler } = stubWiredPair({ rows: backlogRows(3), heartbeatTimeoutMs: 15000 })
    const { session } = connectNode(registry, 'node-1', info)
    await loadFirstPage(scheduler)
    assert.equal(sentTasks(session).length, 1)
    assert.equal(scheduler.queue.size, 2)
    assert.equal(registry.pickIdleNode(), null)
    const topology = await registry.getTopology()
    assert.equal(topology.nodes[0].taskCapacity, 1)
  }
}))

test('下发前预占节点与切片，发送失败回滚所有占用且保留排队任务', () => withSilentConsole(async () => {
  const { registry, scheduler } = stubWiredPair({ rows: backlogRows(2), heartbeatTimeoutMs: 15000 })
  const { session } = connectNode(registry, 'node-1', { task_capacity: 2 })
  session.send = frame => {
    if (frame.task) {
      assert.equal(registry.nodes.get('node-1').activeTasks.has(frame.task.task_id), true)
      assert.equal(scheduler.dispatchedTasks.has(frame.task.task_id), true)
      assert.equal(scheduler.inflight.size, 1)
      throw new Error('stream write failed')
    }
  }
  await loadFirstPage(scheduler)
  assert.equal(registry.nodes.get('node-1').activeTasks.size, 0)
  assert.equal(registry.pickIdleNode(), 'node-1')
  assert.equal(scheduler.dispatchedTasks.size, 0)
  assert.equal(scheduler.inflight.size, 0)
  assert.equal(scheduler.queue.size, 2)
}))

test('新节点接入和容量增大立刻填充已有队列，滞后心跳不抹掉预占任务', () => withSilentConsole(async () => {
  const { registry, scheduler } = stubWiredPair({ rows: backlogRows(5), heartbeatTimeoutMs: 15000 })
  await loadFirstPage(scheduler)
  bufferRows(scheduler, backlogRows(5))
  assert.equal(scheduler.queue.size, 5)
  const { session, handle } = connectNode(registry, 'node-1', { task_capacity: 2 })
  assert.equal(sentTasks(session).length, 2)
  handle.onFrame(heartbeatFrame(2))
  assert.equal(sentTasks(session).length, 2)
  assert.equal(registry.nodes.get('node-1').activeTasks.size, 2)
  handle.onFrame(heartbeatFrame(4))
  assert.equal(sentTasks(session).length, 4)
  assert.equal(registry.nodes.get('node-1').activeTasks.size, 4)
  assert.equal(scheduler.queue.size, 1)
}))

test('新 master 从活跃任务恢复容量与切片占用，恢复任务完成不重复落定', () => withSilentConsole(async () => {
  const recoveredId = 'clean:2026-09-29:2026-09-28:s-recovered:r1'
  const rows = [{ session_id: 's-recovered', date: '2026-09-28' }, ...backlogRows(3)]
  const { registry, scheduler } = stubWiredPair({ rows, heartbeatTimeoutMs: 15000 })
  // 先枚举、后节点接入，也必须过滤新注册帧恢复的同切片任务。
  await loadFirstPage(scheduler)
  bufferRows(scheduler, rows)
  const { session, handle } = connectNode(registry, 'node-1', {
    task_capacity: 2, busy: true, busy_task_id: recoveredId, active_task_ids: [recoveredId],
  })
  assert.equal(registry.hasActiveSlice('2026-09-28', 's-recovered'), true)
  assert.equal(sentTasks(session).length, 1)
  assert.equal(sentTasks(session)[0].session_id, 's-capacity-0')
  assert.equal(scheduler.queue.size, 3)
  await scheduler.enqueueBacklog()
  assert.equal(scheduler.queue.size, 3)
  let settlements = 0
  registry.onTaskSettled(() => { settlements++ })
  handle.onFrame(progressFrame(recoveredId, { completed: true }))
  assert.equal(settlements, 0)
  assert.equal(sentTasks(session).length, 2)
  assert.equal(scheduler.inflight.size, 2)
  // 滞后的心跳再次携带已完成 id 时，不恢复它也不删除其他预占。
  handle.onFrame(heartbeatFrame(2, [recoveredId]))
  assert.equal(registry.nodes.get('node-1').activeTasks.has(recoveredId), false)
  assert.equal(registry.nodes.get('node-1').activeTasks.size, 2)
}))

test('14 个并发任务的今日平均、最快、最慢均使用节点总速度', () => withSilentConsole(() => withClock(async clock => {
  const { registry, redis } = stubRegistryWithRedis()
  const { handle } = connectNode(registry, 'node-1', { task_capacity: 14 })
  const tasks = Array.from({ length: 14 }, (_, i) => ({
    task_id: `clean:2026-10-15:2026-10-14:total-${i}`, date: '2026-10-14', session_id: `total-${i}`,
  }))
  for (const task of tasks) assert.equal(registry.dispatchTask('node-1', task), true)
  clock.advance(1000)
  for (const task of tasks) handle.onFrame(progressFrame(task.task_id, { completed: true }))
  await drainMetrics()
  const topology = await registry.getTopology()
  assert.deepEqual(topology.nodes[0].cleaningSpeed, { current: null, avg: 1400, max: 1400, min: 1400 })
  const row = redis.data.get(nodeCleaningMetricsKey('node-1', metricsWindow().today))
  assert.equal(row.events, '1400')
  assert.equal(row.durationMs, '1000', '14 个任务重叠的一秒只计一次')
  assert.equal(row.samples, '1')
})))

test('采样后同一毫秒完成仍保留尾段处理量，零事件零时长不产生额外样本', () => withSilentConsole(() => withClock(async clock => {
  const { registry, redis } = stubRegistryWithRedis()
  const { handle } = connectNode(registry)
  const task = { task_id: 'same-millisecond-tail', date: '2026-10-14', session_id: 'same-millisecond-tail' }
  registry.dispatchTask('node-1', task)
  clock.advance(1000)
  handle.onFrame(progressFrame(task.task_id, { progress: 40 }))
  registry.sampleTotalSpeeds(clock.now())
  handle.onFrame(progressFrame(task.task_id, { completed: true }))
  await drainMetrics()
  const key = nodeCleaningMetricsKey('node-1', metricsWindow().today)
  const row = redis.data.get(key)
  assert.equal(row.events, '100', '不能丢弃采样后同一毫秒到达的尾段 60 个事件')
  assert.equal(row.durationMs, '1001', '仅非空尾段按 Date.now 的最小 1ms 精度计时')
  assert.equal(row.samples, '2')
  registry.sampleTotalSpeeds(clock.now())
  await drainMetrics()
  assert.equal(row.samples, '2', '空闲时无处理量的零长度区间不能重复计样本')
})))

test('任务错开开始和结束，节点累计时长使用忙碌区间并集且完成一个不重置其他任务', () => withSilentConsole(() => withClock(async clock => {
  const { registry, redis } = stubRegistryWithRedis()
  const { handle } = connectNode(registry, 'node-1', { task_capacity: 2 })
  const firstId = 'clean:2026-10-14:2026-09-28:s-speed-1'
  const secondId = 'clean:2026-10-14:2026-09-28:s-speed-2'
  registry.dispatchTask('node-1', { task_id: firstId, date: '2026-09-28', session_id: 's-speed-1' })
  clock.advance(1000)
  registry.dispatchTask('node-1', { task_id: secondId, date: '2026-09-28', session_id: 's-speed-2' })
  const active = registry.nodes.get('node-1').activeTasks
  const first = active.get(firstId)
  const second = active.get(secondId)
  const secondStartedAt = second.startedAt
  clock.advance(1000)
  handle.onFrame(progressFrame(firstId, { progress: 100 }))
  handle.onFrame(progressFrame(secondId, { progress: 60 }))
  registry.sampleTotalSpeeds(clock.now())
  assert.equal((await registry.getTopology()).nodes[0].cleaningSpeed.current, 80)
  clock.advance(3000)
  handle.onFrame(progressFrame(firstId, { completed: true }))
  registry.sampleTotalSpeeds(clock.now())
  assert.equal((await registry.getTopology()).nodes[0].cleaningSpeed.current, 32)
  assert.equal(second.startedAt, secondStartedAt)
  assert.equal(second.creditedProgress, 60)
  assert.equal(first.creditedProgress, 100)
  await drainMetrics()
  let metrics = redis.data.get(nodeCleaningMetricsKey('node-1', metricsWindow().today))
  assert.equal(metrics.events, '160')
  assert.equal(metrics.durationMs, '5000')
  assert.equal(metrics.maxSpeed, '80')
  assert.equal(metrics.minSpeed, '0')
  clock.advance(1000)
  handle.onFrame(progressFrame(secondId, { completed: true }))
  await drainMetrics()
  metrics = redis.data.get(nodeCleaningMetricsKey('node-1', metricsWindow().today))
  assert.equal(metrics.events, '200')
  assert.equal(metrics.durationMs, '6000', '不能累加两个任务各自的 5 秒耗时')
  assert.equal(metrics.samples, '3')
  assert.deepEqual((await registry.getTopology()).nodes[0].cleaningSpeed, {
    current: null, avg: 200 / 6, max: 80, min: 0,
  })
})))

test('定时采样在忙碌无新进度时记录零速，空闲间隔不进入今日平均分母', () => withSilentConsole(() => withClock(async clock => {
  const { registry, redis } = stubRegistryWithRedis()
  const { handle } = connectNode(registry)
  const dispatch = taskId => registry.dispatchTask('node-1', { task_id: taskId, date: '2026-10-14', session_id: taskId })
  dispatch('first-run')
  handle.onFrame(progressFrame('first-run', { progress: 0 }))
  clock.advance(1000)
  handle.onFrame(progressFrame('first-run', { progress: 100 }))
  registry.sampleTotalSpeeds(clock.now())
  await drainMetrics()
  assert.deepEqual((await registry.getTopology()).nodes[0].cleaningSpeed, { current: 100, avg: 100, max: 100, min: 100 })
  clock.advance(1000)
  registry.sampleTotalSpeeds(clock.now())
  await drainMetrics()
  assert.deepEqual((await registry.getTopology()).nodes[0].cleaningSpeed, { current: 50, avg: 50, max: 100, min: 0 })
  handle.onFrame(progressFrame('first-run', { completed: true }))
  clock.advance(60000)
  registry.sampleTotalSpeeds(clock.now())
  const second = connectNode(registry)
  dispatch('second-run')
  clock.advance(1000)
  second.handle.onFrame(progressFrame('second-run', { completed: true }))
  await drainMetrics()
  const row = redis.data.get(nodeCleaningMetricsKey('node-1', metricsWindow().today))
  assert.equal(row.events, '200')
  assert.equal(row.durationMs, '3000')
  assert.deepEqual((await registry.getTopology()).nodes[0].cleaningSpeed, { current: null, avg: 200 / 3, max: 100, min: 0 })
})))

test('同步完成回调不会残留 inflight，完成任务的历史记录有界', () => withSilentConsole(async () => {
  const { registry, scheduler } = stubWiredPair({ rows: backlogRows(2), heartbeatTimeoutMs: 15000 })
  const { session, handle } = connectNode(registry)
  session.send = frame => {
    if (frame.task) handle.onFrame(progressFrame(frame.task.task_id, { completed: true }))
  }
  await loadFirstPage(scheduler)
  assert.equal(scheduler.inflight.size, 0)
  assert.equal(scheduler.dispatchedTasks.size, 0)
  assert.equal(scheduler.queue.size, 0)
  for (let i = 0; i < 1005; i++) {
    assert.equal(registry.dispatchTask('node-1', { task_id: `task-history-${i}`, date: '2026-09-28', session_id: `s-history-${i}` }), true)
  }
  assert.equal(registry.nodes.get('node-1').finishedTaskIds.size, 1000)
}))

test('新流恢复快照释放断连期间已结束的任务并安全重试，其余任务继续占用', () => withSilentConsole(async () => {
  const { registry, scheduler } = stubWiredPair({ rows: backlogRows(2), heartbeatTimeoutMs: 15000 })
  const original = connectNode(registry, 'node-1', { task_capacity: 2 })
  await loadFirstPage(scheduler)
  const [first, second] = sentTasks(original.session)
  const secondState = registry.nodes.get('node-1').activeTasks.get(second.task_id)
  original.handle.onClose('短暂断连')
  // first 已在断连期间结束，终态帧丢失；新流只上报仍在运行的 second。
  const replacement = connectNode(registry, 'node-1', {
    task_capacity: 2, active_task_ids: [second.task_id], busy: true, busy_task_id: second.task_id,
  })
  const active = registry.nodes.get('node-1').activeTasks
  assert.equal(active.size, 2)
  assert.equal(active.get(second.task_id), secondState)
  assert.equal(active.has(first.task_id), false)
  assert.equal(active.has(`${first.task_id}:r1`), true)
  assert.equal(scheduler.inflight.size, 2)
  assert.deepEqual(sentTasks(replacement.session).map(task => task.task_id), [`${first.task_id}:r1`])
  // 旧任务的迟到终态不能释放 B 或 A 的重试。
  replacement.handle.onFrame(progressFrame(first.task_id, { completed: true }))
  original.handle.onFrame(progressFrame(second.task_id, { completed: true }))
  assert.equal(active.size, 2)
  replacement.handle.onFrame(progressFrame(`${first.task_id}:r1`, { completed: true }))
  assert.equal(active.size, 1)
  assert.equal(active.has(second.task_id), true)
  assert.equal(scheduler.inflight.size, 1)
}))

test('旧节点重连使用 busy_task_id 恢复快照，空快照释放丢失终态的预占', () => withSilentConsole(async () => {
  const { registry, scheduler } = stubWiredPair({ rows: backlogRows(1), heartbeatTimeoutMs: 15000 })
  const original = connectNode(registry)
  await loadFirstPage(scheduler)
  const task = sentTasks(original.session)[0]
  original.handle.onClose('断开')
  const running = connectNode(registry, 'node-1', { busy: true, busy_task_id: task.task_id })
  assert.equal(registry.nodes.get('node-1').activeTasks.has(task.task_id), true)
  assert.equal(sentTasks(running.session).length, 0)
  running.handle.onClose('再次断开')
  const finished = connectNode(registry)
  assert.equal(registry.nodes.get('node-1').activeTasks.has(task.task_id), false)
  assert.equal(registry.nodes.get('node-1').activeTasks.has(`${task.task_id}:r1`), true)
  assert.equal(sentTasks(finished.session)[0].task_id, `${task.task_id}:r1`)
}))

test('多个节点各按自己的容量接收任务，心跳超时后原流恢复仍保留正在执行的占用', () => withSilentConsole(async () => {
  const { registry, scheduler } = stubWiredPair({ rows: backlogRows(5), heartbeatTimeoutMs: 15000 })
  const first = connectNode(registry, 'node-1', { task_capacity: 2 })
  const second = connectNode(registry, 'node-2')
  await loadFirstPage(scheduler)
  assert.equal(sentTasks(first.session).length, 2)
  assert.equal(sentTasks(second.session).length, 1)
  assert.equal(scheduler.queue.size, 2)
  const firstTasks = sentTasks(first.session)
  // 强制心跳过期但保持流未关闭，模拟短暂网络阻塞后原流恢复。
  registry.nodes.get('node-1').lastHeartbeat = Date.now() - 16000
  await registry.reconcileStatus()
  assert.equal(registry.nodes.get('node-1').activeTasks.size, 0)
  first.handle.onFrame(heartbeatFrame(2, firstTasks.map(task => task.task_id)))
  assert.equal(registry.nodes.get('node-1').activeTasks.size, 2)
  assert.equal(registry.pickIdleNode(), null)
  assert.equal(sentTasks(first.session).length, 2)
  // 已经在离线时落定过，恢复的原任务完成不重复触发 settlement。
  let settlements = 0
  registry.onTaskSettled(() => { settlements++ })
  first.handle.onFrame(progressFrame(firstTasks[0].task_id, { completed: true }))
  assert.equal(settlements, 0)
  assert.equal(registry.nodes.get('node-1').activeTasks.size, 2)
  assert.equal(sentTasks(first.session).length, 3)
}))

test('离线后的重试被恢复中的旧任务挡住时保留排队，旧任务结束后继续派发', () => withSilentConsole(async () => {
  const { registry, scheduler } = stubWiredPair({ rows: backlogRows(2), heartbeatTimeoutMs: 15000 })
  const original = connectNode(registry, 'node-1', { task_capacity: 2 })
  await loadFirstPage(scheduler)
  const [first, second] = sentTasks(original.session)
  original.handle.onClose('断流')
  await registry.reconcileStatus()
  assert.equal(scheduler.queue.size, 2)
  const replacement = connectNode(registry, 'node-1', {
    task_capacity: 2, active_task_ids: [first.task_id, second.task_id],
  })
  assert.equal(scheduler.queue.size, 2)
  assert.equal(scheduler.retryBases.size, 2)
  assert.equal(sentTasks(replacement.session).length, 0)
  // 恢复任务只占容量、不再次落定，但终态会唤醒容量监听继续派发原重试。
  replacement.handle.onFrame(progressFrame(first.task_id, { completed: true }))
  assert.deepEqual(sentTasks(replacement.session).map(task => task.task_id), [`${first.task_id}:r1`])
  assert.equal(scheduler.queue.size, 1)
  assert.equal(registry.nodes.get('node-1').activeTasks.has(second.task_id), true)
  replacement.handle.onFrame(progressFrame(second.task_id, { failed: true, error: 'recovered task failed' }))
  assert.deepEqual(sentTasks(replacement.session).map(task => task.task_id), [`${first.task_id}:r1`, `${second.task_id}:r1`])
  assert.equal(scheduler.queue.size, 0)
  replacement.handle.onFrame(progressFrame(`${first.task_id}:r1`, { completed: true }))
  replacement.handle.onFrame(progressFrame(`${second.task_id}:r1`, { completed: true }))
  assert.equal(scheduler.inflight.size, 0)
  assert.equal(scheduler.retryBases.size, 0)
}))

test('连续毫秒级 session 的实时速度跨任务保留，progress 和完成帧不重复计数', () => withSilentConsole(() => withClock(async clock => {
  const { registry, scheduler } = stubWiredPair({ rows: backlogRows(20), heartbeatTimeoutMs: 15000 })
  const { session, handle } = connectNode(registry)
  await loadFirstPage(scheduler)
  for (let i = 0; i < 5; i++) {
    clock.advance(10)
    const task = sentTasks(session).at(-1)
    handle.onFrame(progressFrame(task.task_id, { target: 10, progress: 10 }))
    handle.onFrame(progressFrame(task.task_id, { target: 10, progress: 10, completed: true }))
  }
  assert.equal(sentTasks(session).length, 6)
  assert.equal(registry.nodes.get('node-1').activeTasks.size, 1)
  // 5 × 10 个事件 / 最少 0.5s 观察分母。
  assert.equal((await registry.getTopology()).nodes[0].cleaningSpeed.current, 100)
  clock.advance(450)
  const sixth = sentTasks(session).at(-1)
  // 兼容没有中间进度的旧节点：完成帧补齐本任务的 10 个事件。
  handle.onFrame(progressFrame(sixth.task_id, { target: 10, progress: 10, completed: true }))
  assert.equal((await registry.getTopology()).nodes[0].cleaningSpeed.current, 120)
  clock.advance(500)
  const seventh = sentTasks(session).at(-1)
  handle.onFrame(progressFrame(seventh.task_id, { target: 10, progress: 10, completed: true }))
  assert.equal((await registry.getTopology()).nodes[0].cleaningSpeed.current, 70)
})))

test('进度只累计单调增量，失败不补 target，幂等重放和重复终态不造处理量', () => withSilentConsole(() => withClock(async clock => {
  const { registry } = stubRegistryWithRedis()
  const { handle } = connectNode(registry, 'node-1', { task_capacity: 2 })
  const dispatch = taskId => registry.dispatchTask('node-1', { task_id: taskId, date: '2026-09-28', session_id: taskId })
  dispatch('keep-busy')
  dispatch('processing')
  for (const processed of [20, 20, 10, 60]) {
    clock.advance(100)
    handle.onFrame(progressFrame('processing', { progress: processed }))
  }
  clock.advance(100)
  handle.onFrame(progressFrame('processing', { completed: true }))
  handle.onFrame(progressFrame('processing', { completed: true }))
  assert.equal((await registry.getTopology()).nodes[0].cleaningSpeed.current, 200)
  dispatch('failed')
  clock.advance(100)
  handle.onFrame(progressFrame('failed', { progress: 40 }))
  clock.advance(100)
  handle.onFrame(progressFrame('failed', { progress: 100, failed: true, error: 'write failed' }))
  dispatch('replay')
  handle.onFrame(progressFrame('replay', { target: 0, progress: 0, completed: true }))
  handle.onFrame(progressFrame('unknown', { completed: true }))
  // 成功任务已观察 100 + 失败任务已观察 40；失败的尾段 60 和重放均不补量。
  assert.equal((await registry.getTopology()).nodes[0].cleaningSpeed.current, 200)
  assert.equal(registry.nodes.get('node-1').speedBuckets.reduce((sum, bucket) => sum + bucket.events, 0), 140)
  await drainMetrics()
  await drainMetrics()
})))

test('长 session 停止推进后窗口过期归零，空闲/离线清窗且新任务重新观察', () => withSilentConsole(() => withClock(async clock => {
  const { registry } = stubRegistryWithRedis()
  const { handle } = connectNode(registry)
  const task = { task_id: 'long-running', date: '2026-09-28', session_id: 'long-running' }
  registry.dispatchTask('node-1', task)
  for (let i = 1; i <= 30; i++) {
    clock.advance(500)
    handle.onFrame(progressFrame(task.task_id, { target: 10000, progress: i * 100 }))
    assert.ok(registry.nodes.get('node-1').speedBuckets.length <= 12)
  }
  assert.equal((await registry.getTopology()).nodes[0].cleaningSpeed.current, 200)
  clock.advance(6000)
  assert.equal((await registry.getTopology()).nodes[0].cleaningSpeed.current, 0)
  assert.equal(registry.nodes.get('node-1').speedBuckets.length, 0)
  handle.onFrame(progressFrame(task.task_id, { failed: true, error: 'stopped' }))
  assert.equal((await registry.getTopology()).nodes[0].cleaningSpeed.current, null)
  assert.equal(registry.nodes.get('node-1').speedWindowStartedAt, null)
  registry.dispatchTask('node-1', { ...task, task_id: 'new-task' })
  assert.equal((await registry.getTopology()).nodes[0].cleaningSpeed.current, 0)
  clock.advance(100)
  handle.onFrame(progressFrame('new-task', { progress: 50 }))
  assert.equal((await registry.getTopology()).nodes[0].cleaningSpeed.current, 100)
  handle.onClose('offline')
  assert.equal((await registry.getTopology()).nodes[0].cleaningSpeed.current, null)
  assert.equal(registry.nodes.get('node-1').speedBuckets.length, 0)
  await drainMetrics()
})))

test('恢复任务以首个进度为基线，只有完成帧时不把历史处理量记为实时速度', () => withSilentConsole(() => withClock(async clock => {
  const { registry } = stubRegistryWithRedis()
  const { handle } = connectNode(registry, 'node-1', {
    task_capacity: 3, active_task_ids: ['recovered-progress', 'recovered-terminal'],
  })
  registry.dispatchTask('node-1', { task_id: 'keep-busy', date: '2026-09-28', session_id: 'keep-busy' })
  clock.advance(100)
  handle.onFrame(progressFrame('recovered-progress', { progress: 50 }))
  assert.equal((await registry.getTopology()).nodes[0].cleaningSpeed.current, 0)
  clock.advance(100)
  handle.onFrame(progressFrame('recovered-progress', { progress: 70 }))
  assert.equal((await registry.getTopology()).nodes[0].cleaningSpeed.current, 40)
  clock.advance(100)
  handle.onFrame(progressFrame('recovered-progress', { completed: true }))
  assert.equal((await registry.getTopology()).nodes[0].cleaningSpeed.current, 100)
  clock.advance(100)
  handle.onFrame(progressFrame('recovered-terminal', { completed: true }))
  assert.equal((await registry.getTopology()).nodes[0].cleaningSpeed.current, 100)
  await drainMetrics()
  await drainMetrics()
})))

test('断连结算已观察区间，重连任务重建进度基线且离线间隔不计总速度', () => withSilentConsole(() => withClock(async clock => {
  const { registry, redis } = stubRegistryWithRedis()
  const original = connectNode(registry)
  const task = { task_id: 'reconnected-speed', date: '2026-10-14', session_id: 'reconnected-speed' }
  assert.equal(registry.dispatchTask('node-1', task), true)
  clock.advance(1000)
  original.handle.onFrame(progressFrame(task.task_id, { progress: 20 }))
  original.handle.onClose('暂时断连')
  await drainMetrics()
  const key = nodeCleaningMetricsKey('node-1', metricsWindow().today)
  assert.equal(redis.data.get(key).events, '20')
  assert.equal(redis.data.get(key).durationMs, '1000')
  clock.advance(20000)
  const replacement = connectNode(registry, 'node-1', { active_task_ids: [task.task_id], busy_task_id: task.task_id })
  replacement.handle.onFrame(progressFrame(task.task_id, { progress: 70 }))
  assert.equal((await registry.getTopology()).nodes[0].cleaningSpeed.current, 0)
  clock.advance(1000)
  replacement.handle.onFrame(progressFrame(task.task_id, { completed: true }))
  await drainMetrics()
  const row = redis.data.get(key)
  assert.equal(row.events, '50', '断连期间从 20 到 70 的进度不算重连瞬间新处理量')
  assert.equal(row.durationMs, '2000')
  assert.deepEqual((await registry.getTopology()).nodes[0].cleaningSpeed, { current: null, avg: 25, max: 30, min: 20 })
})))

test('上海午夜拆分节点忙碌墙钟，已观察进度留在昨日而新进度进入今日', () => withSilentConsole(() => withClock(async clock => {
  clock.set('2026-10-14T23:59:59.500+08:00')
  const { registry, redis } = stubRegistryWithRedis()
  const { handle } = connectNode(registry)
  const task = { task_id: 'cross-midnight-speed', date: '2026-10-13', session_id: 'cross-midnight-speed' }
  registry.dispatchTask('node-1', task)
  clock.advance(250)
  handle.onFrame(progressFrame(task.task_id, { progress: 20 }))
  clock.advance(500)
  handle.onFrame(progressFrame(task.task_id, { progress: 40 }))
  await drainMetrics()
  const yesterday = redis.data.get(nodeCleaningMetricsKey('node-1', '2026-10-14'))
  assert.equal(yesterday.events, '20')
  assert.equal(yesterday.durationMs, '500')
  assert.equal(yesterday.maxSpeed, '40')
  clock.advance(750)
  handle.onFrame(progressFrame(task.task_id, { completed: true }))
  await drainMetrics()
  const today = redis.data.get(nodeCleaningMetricsKey('node-1', '2026-10-15'))
  assert.equal(today.events, '80')
  assert.equal(today.durationMs, '1000')
  assert.deepEqual((await registry.getTopology()).nodes[0].cleaningSpeed, { current: null, avg: 80, max: 80, min: 80 })
})))

test('节点心跳超时的总速度止于最后心跳加超时，不能继续累计离线时长', () => withSilentConsole(() => withClock(async clock => {
  const { registry, redis } = stubRegistryWithRedis()
  const { handle } = connectNode(registry)
  registry.dispatchTask('node-1', { task_id: 'timeout-speed', date: '2026-10-14', session_id: 'timeout-speed' })
  handle.onFrame(progressFrame('timeout-speed', { progress: 20 }))
  clock.advance(20000)
  registry.sampleTotalSpeeds(clock.now())
  await registry.reconcileStatus()
  await drainMetrics()
  const row = redis.data.get(nodeCleaningMetricsKey('node-1', metricsWindow().today))
  assert.equal(row.events, '20')
  assert.equal(row.durationMs, '15000')
  assert.deepEqual((await registry.getTopology()).nodes[0].cleaningSpeed, {
    current: null, avg: 20 / 15, max: 20 / 15, min: 20 / 15,
  })
})))

test('未经定时巡检就收到超时断流时，总速度同样截止最后心跳加超时', () => withSilentConsole(() => withClock(async clock => {
  const { registry, redis } = stubRegistryWithRedis()
  const { handle } = connectNode(registry)
  registry.dispatchTask('node-1', { task_id: 'late-close-speed', date: '2026-10-14', session_id: 'late-close-speed' })
  handle.onFrame(progressFrame('late-close-speed', { progress: 20 }))
  clock.advance(20000)
  handle.onClose('超时后才关闭链接')
  await drainMetrics()
  const row = redis.data.get(nodeCleaningMetricsKey('node-1', metricsWindow().today))
  assert.equal(row.events, '20')
  assert.equal(row.durationMs, '15000')
  assert.deepEqual((await registry.getTopology()).nodes[0].cleaningSpeed, {
    current: null, avg: 20 / 15, max: 20 / 15, min: 20 / 15,
  })
})))
