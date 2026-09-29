const assert = require('node:assert/strict')
const { test } = require('node:test')
require('reflect-metadata')
require('ts-node').register({ transpileOnly: true, skipProject: true, compilerOptions: {
  target: 'ES2022', module: 'CommonJS', moduleResolution: 'node', experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true,
} })
const { buildTaskId, planCleaningTasks, CleaningSchedulerService } = require('../apps/data-dashboard-api-service/src/api/compute-node/cleaning-scheduler.service.ts')
const { NodeRegistryService } = require('../apps/data-dashboard-api-service/src/api/compute-node/node-registry.service.ts')

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
    pickIdleNode() { return idle ? 'node-1' : null },
    dispatchTask(nodeId, task) { dispatched.push(task.task_id); return true },
  }
  const clickhouse = { query: async () => rows }
  const scheduler = new CleaningSchedulerService(registry, clickhouse, {}, {})
  return { scheduler, dispatched, registry }
}

test('连续失败时重试 task_id 按 :r1、:r2 递增，超过上限后放弃', () => {
  const { scheduler, dispatched } = stubScheduler()
  const base = 'clean:2026-09-29:2026-09-28:s-1'
  scheduler.queue.push({ task_id: base, session_id: 's-1', date: '2026-09-28' })
  scheduler.drain()
  scheduler.onTaskSettled(base, true)
  scheduler.onTaskSettled(`${base}:r1`, true)
  scheduler.onTaskSettled(`${base}:r2`, true)
  assert.deepEqual(dispatched, [base, `${base}:r1`, `${base}:r2`])
  assert.equal(scheduler.queue.length, 0)
})

test('同一 (date, session) 在队列积压或任务在途时不重复入队', async () => {
  const rows = [
    { session_id: 's-old', date: '2026-09-28' },
    { session_id: 's-fly', date: '2026-09-28' },
  ]
  const { scheduler, dispatched, registry } = stubScheduler({ rows, idle: false })
  // 场景 a：节点全天离线，队列里积压着昨日 runDate 的旧任务；换天后同一切片不得重复入队，旧任务保留
  scheduler.queue.push({ task_id: 'clean:2026-09-28:2026-09-28:s-old', session_id: 's-old', date: '2026-09-28' })
  await scheduler.enqueueBacklog()
  assert.equal(scheduler.queue.filter(task => task.session_id === 's-old').length, 1)
  assert.equal(scheduler.queue[0].task_id, 'clean:2026-09-28:2026-09-28:s-old')
  // 场景 b：s-fly 下发在途（final_event_log 尚未写入），cleanNow 重新枚举到也不得重发
  registry.pickIdleNode = () => 'node-1'
  scheduler.drain()
  assert.equal(dispatched.length, 2)
  await scheduler.enqueueBacklog()
  assert.equal(scheduler.queue.length, 0)
  assert.equal(dispatched.filter(id => id.includes('s-fly')).length, 1)
})

/**
 * 真实 NodeRegistryService + 真实 CleaningSchedulerService，桩只落在 IO 边界
 * （computeNodeService 写库、ClickHouse 查询、心跳超时配置）。
 * settle 监听手工接线（与 scheduler.onModuleInit 第一行相同），避免拉起 60s 定时器拖住测试进程。
 */
function stubWiredPair({ rows = [], heartbeatTimeoutMs = 1 } = {}) {
  const computeNodeService = {
    upsertFromRegister: async () => {},
    syncStatus: async () => {},
    listRegistered: async () => [],
  }
  const configService = { get: key => key === 'nodeControl.heartbeatTimeoutMs' ? heartbeatTimeoutMs : undefined }
  const registry = new NodeRegistryService(computeNodeService, configService)
  const scheduler = new CleaningSchedulerService(registry, { query: async () => rows }, {}, {})
  registry.onTaskSettled((taskId, failed) => scheduler.onTaskSettled(taskId, failed))
  return { registry, scheduler }
}

/** 接入一个在线节点，返回会话与上行帧入口 */
function connectNode(registry, nodeId = 'node-1') {
  const session = { frames: [], send(frame) { this.frames.push(frame) }, close() {} }
  const handle = registry.openSession(session)
  handle.onFrame({ register: {
    node_id: nodeId, node_name: nodeId, node_address: '', version: '1',
    info: { cpu_count: 1, memory_size: 1024, available_memory_size: 512, available: true, busy: false, busy_task_id: '' },
  } })
  return { session, handle }
}

/** 枚举一条欠账并下发到已接入节点，返回已下发任务的 task_id */
async function dispatchOne(registry, scheduler, session) {
  await scheduler.enqueueBacklog()
  scheduler.drain()
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
  // 心跳超时配置为 1ms，稍等即死亡
  await new Promise(resolve => setTimeout(resolve, 5))
  await registry.reconcileStatus()
  await registry.reconcileStatus()

  assert.equal(settleNotifications, 1)
  assert.equal(scheduler.inflight.size, 0)
  assert.equal(scheduler.queue.length, 1)
  assert.equal(scheduler.queue[0].task_id, `${taskId}:r1`)
})

test('节点断流（detach 已置离线，不走 persistedStatus 跳变）时在途任务同样按失败落定', async () => {
  const rows = [{ session_id: 's-1', date: '2026-09-28' }]
  const { registry, scheduler } = stubWiredPair({ rows })
  const { session, handle } = connectNode(registry)
  const taskId = await dispatchOne(registry, scheduler, session)

  handle.onClose('测试断流')
  await registry.reconcileStatus()

  assert.equal(scheduler.inflight.size, 0)
  assert.equal(scheduler.queue.length, 1)
  assert.equal(scheduler.queue[0].task_id, `${taskId}:r1`)
})
