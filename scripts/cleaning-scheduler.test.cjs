const assert = require('node:assert/strict')
const { test } = require('node:test')
require('reflect-metadata')
require('ts-node').register({ transpileOnly: true, skipProject: true, compilerOptions: {
  target: 'ES2022', module: 'CommonJS', moduleResolution: 'node', experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true,
} })
const { buildTaskId, planCleaningTasks, CleaningSchedulerService } = require('../apps/data-dashboard-api-service/src/api/compute-node/cleaning-scheduler.service.ts')

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
