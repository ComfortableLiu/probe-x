const assert = require('node:assert/strict')
const { test, afterEach } = require('node:test')
const { setImmediate: nextTurn } = require('node:timers/promises')
require('reflect-metadata')
require('ts-node').register({ transpileOnly: true, skipProject: true, compilerOptions: {
  target: 'ES2022', module: 'CommonJS', moduleResolution: 'node', experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true,
} })
const { CleaningSchedulerService, planCleaningTasks } = require('../apps/data-dashboard-api-service/src/api/compute-node/cleaning-scheduler.service.ts')
const { NodeRegistryService } = require('../apps/data-dashboard-api-service/src/api/compute-node/node-registry.service.ts')
const { readCleaningBacklogPage, readRustIncompleteSlices } = require('../apps/data-dashboard-api-service/src/api/compute-node/cleaning-backlog-reader.ts')

const schedulers = new Set()
afterEach(() => {
  for (const scheduler of schedulers) scheduler.onModuleDestroy()
  schedulers.clear()
})

const DATE = '2026-10-14'
const row = (session, date = DATE) => ({ date, session_id: session })
const key = value => JSON.stringify([value.date, value.session_id])
const source = value => ({ ...value, service_time: `${value.date} 12:00:00.000`, event_name: 'page_view' })

function redisStub(incomplete = []) {
  const flagged = new Set(incomplete.map(key))
  const calls = []
  const client = {
    status: 'ready',
    failed: false,
    pipeline() {
      const commands = []
      return {
        sismember(redisKey, session) { commands.push([redisKey, session]); return this },
        async exec() {
          calls.push(commands)
          assert.equal(new Set(commands.map(command => command[0])).size, 1, '一个 pipeline 只访问一个日期 key')
          if (client.failed) return commands.map(() => [new Error('Redis unavailable'), null])
          return commands.map(([redisKey, session]) => [null, Number(flagged.has(key(row(session, redisKey.split(':').at(-1)))))])
        },
      }
    },
  }
  return { client, calls, flagged, service: { getClient: () => client } }
}

function clickhouseStub(rows, completed = rows) {
  const done = new Set(completed.map(key))
  const calls = []
  return {
    calls,
    async query(sql, params) {
      calls.push({ sql, params })
      if (sql.includes('FROM final_event_log')) return rows.filter(value => done.has(key(value)))
      if (params.afterTime) return []
      return rows.map(source).slice(0, params.pageSize)
    },
  }
}

function setup(rows = [], incomplete = [], completed = rows) {
  const registry = new NodeRegistryService({
    upsertFromRegister: async () => {}, syncStatus: async () => {}, listRegistered: async () => [],
  }, { get: () => 15000 })
  const redis = redisStub(incomplete)
  const clickhouse = clickhouseStub(rows, completed)
  const scheduler = new CleaningSchedulerService(registry, clickhouse, redis.service, {})
  schedulers.add(scheduler)
  registry.onTaskSettled((taskId, failed) => scheduler.onTaskSettled(taskId, failed))
  registry.onCapacityAvailable(() => scheduler.drain())
  return { registry, scheduler, redis, clickhouse }
}

function connect(registry, id, version = '1.0.0', info = {}) {
  const session = { frames: [], send(frame) { this.frames.push(frame) }, close() {} }
  const handle = registry.openSession(session)
  handle.onFrame({ register: {
    node_id: id, node_name: id, node_address: '', version,
    info: { cpu_count: 1, task_capacity: 1, memory_size: 1024, available_memory_size: 512,
      available: true, busy: false, busy_task_id: '', busy_task_ids: [], ...info },
  } })
  return { session, handle, tasks: () => session.frames.filter(frame => frame.task).map(frame => frame.task) }
}

async function waitFor(condition, message = '调度状态应推进') {
  for (let index = 0; index < 100; index++) {
    if (condition()) return
    await nextTurn()
  }
  assert.ok(condition(), message)
}

function task(session, requiredRuntime) {
  return { task_id: `clean:2026-10-15:${DATE}:${session}`, date: DATE, session_id: session,
    ...(requiredRuntime ? { required_runtime: requiredRuntime } : {}) }
}

test('Rust 部分落库切片保留在欠账页并标记只能由 Rust 补齐', async () => {
  const candidates = [row('complete'), row('partial'), row('fresh')]
  const ch = clickhouseStub(candidates, candidates.slice(0, 2))
  const redis = redisStub([candidates[1]])
  const page = await readCleaningBacklogPage(ch, { runDate: '2026-10-15', throughDate: DATE }, null, 100,
    undefined, values => readRustIncompleteSlices(redis.client, values))
  assert.deepEqual(page.rows, [{ ...row('partial'), required_runtime: 'rust' }, row('fresh')])
  assert.ok(page.nextCursor)
  assert.deepEqual(planCleaningTasks(page.rows, '2026-10-15')[0], task('partial', 'rust'))
})

test('即使尚无最终事件，已有 Rust 未完成标记也必须保留运行时限制', async () => {
  const candidates = [row('failed-before-first-insert')]
  const redis = redisStub(candidates)
  const page = await readCleaningBacklogPage(clickhouseStub(candidates, []),
    { runDate: '2026-10-15', throughDate: DATE }, null, 100, undefined,
    values => readRustIncompleteSlices(redis.client, values))
  assert.equal(page.rows[0].required_runtime, 'rust')
})

test('Redis 标记按日期拆 pipeline，节点 key 中特殊字符不影响查重', async () => {
  const candidates = [row('a:{}|\n'), row('b'), row('c', '2026-10-13')]
  const redis = redisStub([candidates[0], candidates[2]])
  const incomplete = await readRustIncompleteSlices(redis.client, candidates)
  assert.deepEqual([...incomplete].sort(), [key(candidates[0]), key(candidates[2])].sort())
  assert.equal(redis.calls.length, 2)
})

test('Redis 未就绪、pipeline 内错误或无完整结果都不能当成标记不存在', async () => {
  const redis = redisStub()
  redis.client.status = 'reconnecting'
  await assert.rejects(readRustIncompleteSlices(redis.client, [row('partial')]), /暂不可用/)
  redis.client.status = 'ready'
  redis.client.failed = true
  await assert.rejects(readRustIncompleteSlices(redis.client, [row('partial')]), /读取失败/)
  redis.client.pipeline = () => ({ sismember() {}, exec: async () => null })
  await assert.rejects(readRustIncompleteSlices(redis.client, [row('partial')]), /读取失败/)
})

test('混合节点下普通任务仍可下发到 Node，指定 Rust 的任务不可绕过 registry 限制', () => {
  const { registry, scheduler } = setup()
  const node = connect(registry, 'node')
  connect(registry, 'rust', 'rust-0.1.0')
  scheduler.enqueueTask(task('ordinary'))
  scheduler.drain()
  assert.equal(node.tasks().length, 1)
  assert.equal(node.tasks()[0].required_runtime, undefined)
  assert.equal(registry.dispatchTask('node', task('partial', 'rust')), false)
  assert.equal(registry.pickIdleNode('rust'), 'rust')
})

test('分页发现的 Rust 部分切片仅下发 Rust，其他普通切片可并行下发 Node', async () => {
  const candidates = [row('partial'), row('ordinary')]
  const { registry, scheduler } = setup(candidates, [candidates[0]], [candidates[0]])
  const node = connect(registry, 'node')
  const rust = connect(registry, 'rust', 'rust-0.1.0')
  await scheduler.cleanNow(DATE)
  await waitFor(() => node.tasks().length === 1 && rust.tasks().length === 1)
  assert.equal(rust.tasks()[0].session_id, 'partial')
  assert.equal(rust.tasks()[0].required_runtime, 'rust')
  assert.equal(node.tasks()[0].session_id, 'ordinary')
})

test('首次下发 Rust 后失败重试保留运行时限制，Rust 离线也不能改派 Node', async () => {
  const { registry, scheduler } = setup()
  const rust = connect(registry, 'rust', 'rust-0.1.0')
  const node = connect(registry, 'node')
  scheduler.enqueueTask(task('first-rust'))
  scheduler.drain()
  assert.equal(rust.tasks()[0].required_runtime, 'rust')
  rust.handle.onClose('test disconnect')
  await registry.reconcileStatus()
  assert.equal(node.tasks().length, 0)
  assert.equal(scheduler.queue.size, 1)
  assert.equal([...scheduler.queue.values()][0].required_runtime, 'rust')
  assert.match([...scheduler.queue.values()][0].task_id, /:r1$/)
  const recovered = connect(registry, 'rust-recovered', 'rust-0.1.0')
  assert.equal(recovered.tasks().length, 1)
  assert.equal(recovered.tasks()[0].required_runtime, 'rust')
})

test('缺少 Rust 槽位时跳过受限任务，后续普通任务继续使用 Node', () => {
  const { registry, scheduler } = setup()
  const node = connect(registry, 'node')
  scheduler.enqueueTask(task('partial', 'rust'))
  scheduler.enqueueTask(task('ordinary'))
  scheduler.drain()
  assert.equal(node.tasks().length, 1)
  assert.equal(node.tasks()[0].session_id, 'ordinary')
  assert.equal(scheduler.queue.size, 1)
  assert.equal([...scheduler.queue.values()][0].session_id, 'partial')
})

test('优雅退出 available=false 的节点不接收新任务，但保留已有任务状态', () => {
  const { registry, scheduler } = setup()
  const rust = connect(registry, 'rust', 'rust-0.1.0', { available: false })
  assert.equal(registry.pickIdleNode(), null)
  assert.equal(registry.pickIdleNode('rust'), null)
  assert.equal(registry.dispatchTask('rust', task('new', 'rust')), false)
  scheduler.enqueueTask(task('waiting', 'rust'))
  scheduler.drain()
  assert.equal(rust.tasks().length, 0)
  assert.equal(scheduler.queue.size, 1)
})

test('同连接由 unavailable 恢复为 available 后立即通知调度补发', () => {
  const { registry, scheduler } = setup()
  const rust = connect(registry, 'rust', 'rust-0.1.0', { available: false })
  scheduler.enqueueTask(task('waiting', 'rust'))
  scheduler.drain()
  assert.equal(rust.tasks().length, 0)
  rust.handle.onFrame({ register: {
    node_id: 'rust', node_name: 'rust', version: 'rust-0.1.0',
    info: { cpu_count: 1, task_capacity: 1, available: true, busy: false, busy_task_ids: [] },
  } })
  assert.equal(rust.tasks().length, 1)
  assert.equal(rust.tasks()[0].session_id, 'waiting')
})

test('Redis 标记查询失败时保留原分页游标，恢复后从同一位置重新发现部分切片', async () => {
  const candidates = [row('partial')]
  const { registry, scheduler, redis, clickhouse } = setup(candidates, candidates)
  const rust = connect(registry, 'rust', 'rust-0.1.0')
  redis.client.failed = true
  await scheduler.cleanNow(DATE)
  await waitFor(() => [...scheduler.scans.values()].some(scan => scan.failed))
  assert.equal([...scheduler.scans.values()][0].cursor, null)
  assert.equal(rust.tasks().length, 0)
  redis.client.failed = false
  scheduler.resumeScans()
  await waitFor(() => rust.tasks().length === 1)
  const sources = clickhouse.calls.filter(call => call.sql.includes('FROM event_log'))
  assert.equal(sources[0].params.afterTime, undefined)
  assert.equal(sources[1].params.afterTime, undefined)
  assert.equal(rust.tasks()[0].required_runtime, 'rust')
})
