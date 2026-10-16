const assert = require('node:assert/strict')
const { test } = require('node:test')
const { mkdtempSync, rmSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join, resolve } = require('node:path')
const { Worker } = require('node:worker_threads')
const { setTimeout: delay } = require('node:timers/promises')
const { rspack } = require('@rspack/core')
const protoLoader = require('@grpc/proto-loader')
require('reflect-metadata')
require('ts-node').register({ transpileOnly: true, skipProject: true, compilerOptions: {
  target: 'ES2022', module: 'CommonJS', moduleResolution: 'node', experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true,
} })

const { Logger } = require('@nestjs/common')
const { NodeRegistryService } = require('../apps/data-dashboard-api-service/src/api/compute-node/node-registry.service.ts')
const { CleaningSchedulerService } = require('../apps/data-dashboard-api-service/src/api/compute-node/cleaning-scheduler.service.ts')
const { ComputeNodeService: RegisteredNodeService } = require('../apps/data-dashboard-api-service/src/api/compute-node/compute-node.service.ts')
const { NodeConnectionService } = require('../apps/final-data-cleaning-service/src/service/node-connection.service.ts')
const { ComputeNodeService } = require('../apps/final-data-cleaning-service/src/service/node.service.ts')
const { AttributionWorkerPool } = require('../apps/final-data-cleaning-service/src/lib/attribution-worker-pool.ts')
const { computeAttribution } = require('../apps/final-data-cleaning-service/src/lib/attribution-engine.ts')
const { createBaseEvent, resetEventCounter } = require('../apps/final-data-cleaning-service/src/__tests__/fixtures/event-factory.ts')

const rootDir = resolve(__dirname, '..')
const protoPath = join(rootDir, 'libs/shared-utils/src/lib/backend-common/proto/final_data_cleaning_control_bi_stream.proto')

async function waitFor(condition, message, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs
  while (!condition()) {
    assert.ok(Date.now() < deadline, message)
    await delay(5)
  }
}

function deferred() {
  let resolvePromise
  const promise = new Promise(resolve => { resolvePromise = resolve })
  return { promise, resolve: resolvePromise }
}

/** 与生产构建使用相同的 Node target 和 SWC loader，worker 不加载 TS 或既有 dist。 */
async function compileWorker(outputDir) {
  const compiler = rspack({
    mode: 'development',
    context: rootDir,
    target: 'node',
    entry: join(rootDir, 'apps/final-data-cleaning-service/src/lib/attribution-worker.ts'),
    output: { path: outputDir, filename: 'attribution-worker.js' },
    devtool: false,
    node: { __dirname: false, __filename: false },
    resolve: { extensions: ['.ts', '.js', '.json'] },
    module: { rules: [{
      test: /\.ts$/,
      use: { loader: 'builtin:swc-loader', options: { jsc: { parser: { syntax: 'typescript' } } } },
    }] },
  })
  try {
    await new Promise((resolveBuild, reject) => {
      compiler.run((error, stats) => {
        if (error) return reject(error)
        if (stats.hasErrors()) return reject(new Error(stats.toString({ all: false, errors: true })))
        resolveBuild()
      })
    })
  } finally {
    await new Promise((resolveClose, reject) => compiler.close(error => error ? reject(error) : resolveClose()))
  }
  return join(outputDir, 'attribution-worker.js')
}

/** 注册持久化也保留真实业务服务，仅将数据库 repository 换成内存 IO 边界。 */
function registeredNodeRepository() {
  const rows = new Map()
  return {
    findOne: async ({ where }) => rows.get(where.nodeId) || null,
    create: input => ({ ...input }),
    save: async entity => { rows.set(entity.nodeId, entity); return entity },
    update: async ({ nodeId }, patch) => { Object.assign(rows.get(nodeId) || {}, patch) },
    createQueryBuilder() {
      const builder = {
        where: () => builder,
        orderBy: () => builder,
        getMany: async () => [...rows.values()],
      }
      return builder
    },
  }
}

/**
 * 双向流使用真实 proto-loader 序列化；异步回帧保留真实 gRPC 的事件时序，
 * 避免 fake ACK 同步回调掩盖注册状态或调度重入问题。
 */
function createProtoBridge(registry, observe) {
  const definition = protoLoader.loadSync(protoPath, {
    keepCase: true, longs: String, enums: String, defaults: true, oneofs: true,
  })
  const connect = definition['final_data_cleaning_control_bi_stream.NodeControlService'].Connect
  const upstream = []
  const downstream = []
  let frameHandler
  let closeHandler
  let closed = false
  let handle
  const close = () => {
    if (closed) return
    closed = true
    handle.onClose('验收测试关闭')
    queueMicrotask(() => closeHandler?.())
  }
  const session = {
    send(frame) {
      const decoded = connect.responseDeserialize(connect.responseSerialize(frame))
      downstream.push(decoded)
      queueMicrotask(() => {
        if (closed) return
        frameHandler?.(decoded)
        observe()
      })
    },
    close,
  }
  handle = registry.openSession(session)
  return {
    upstream,
    downstream,
    call: {
      send(frame) {
        const decoded = connect.requestDeserialize(connect.requestSerialize(frame))
        upstream.push(decoded)
        queueMicrotask(() => {
          if (closed) return
          handle.onFrame(decoded)
          observe()
        })
      },
      onFrame: handler => { frameHandler = handler },
      onClose: handler => { closeHandler = handler },
      onError() {},
      close,
    },
  }
}

test('单节点按 CPU 容量同时清洗 3 个完整小 session，完成一个立即补位直至清空', { timeout: 30000 }, async () => {
  const originalLog = console.log
  const originalWarn = console.warn
  console.log = () => {}
  console.warn = () => {}
  Logger.overrideLogger(false)
  const directory = mkdtempSync(join(tmpdir(), 'probe-x-cleaning-concurrency-'))
  const workers = []
  const gates = new Map()
  let releaseAll = false
  let pool
  let registry
  let scheduler
  let connection
  try {
    const workerPath = await compileWorker(directory)
    pool = new AttributionWorkerPool({
      concurrency: 3,
      workerPath,
      workerFactory: filename => {
        const worker = new Worker(filename)
        workers.push(worker)
        return worker
      },
    })
    resetEventCounter()
    const date = '2026-06-01'
    const sessions = Array.from({ length: 7 }, (_, index) => `session-concurrent-${index + 1}`)
    const eventLists = new Map(sessions.map((sessionId, sessionIndex) => [sessionId,
      Array.from({ length: sessionIndex + 3 }, (_, index) => createBaseEvent({
        $session_id: sessionId,
        $is_attribution_event: index % 3 !== 0,
        $target_page_id: `landing-${sessionIndex}-${index}`,
        $ex_attribution_params: index % 5 === 0
          ? '{invalid JSON'
          : JSON.stringify({ $campaign_id: sessionId, $item_count: index }),
      })),
    ]))
    const expected = new Map([...eventLists].map(([sessionId, events]) => [sessionId, computeAttribution(events)]))
    const finalEvents = []
    const attributions = []
    const inserts = []
    const occupancy = []
    let computeNode
    const observe = () => {
      const registryCount = registry?.nodes.get(computeNode?.nodeId)?.activeTasks.size || 0
      const nodeCount = computeNode?.activeTaskCount || 0
      const runningCount = computeNode?.runningTaskCount || 0
      occupancy.push({ registryCount, nodeCount, runningCount })
      assert.ok(registryCount <= 3 && nodeCount <= 3 && runningCount <= 3, '调度与节点占用均不得超过 CPU 容量')
    }
    const clickhouse = {
      async query(sql, params) {
        if (/FROM event_log/.test(sql) && params.pageSize !== undefined) {
          const source = sessions.map((sessionId, index) => ({
            session_id: sessionId, date, event_name: 'page_view',
            service_time: `${date} 00:00:00.${String(index).padStart(3, '0')}`,
          }))
          return source.filter(row => !params.afterTime || row.service_time > params.afterTime)
            .slice(0, params.pageSize)
        }
        if (/FROM final_event_log/.test(sql) && params.candidateSlices) {
          return sessions.filter(sessionId => finalEvents.some(event => event.$session_id === sessionId))
            .map(sessionId => ({ session_id: sessionId, date }))
        }
        if (/SELECT \*\s+FROM event_log/.test(sql)) return eventLists.get(params.sessionId)
        if (/FROM final_event_log/.test(sql)) {
          return finalEvents.filter(event => event.$session_id === params.sessionId)
            .map(event => ({ $event_id: event.$event_id }))
        }
        if (/FROM event_attribution/.test(sql)) {
          return attributions.filter(row => row.session_id === params.sessionId)
            .map(row => ({ event_id: row.event_id }))
        }
        throw new Error(`未预期的 ClickHouse 查询：${sql}`)
      },
      async insert(table, rows) {
        const sessionId = table === 'final_event_log' ? rows[0].$session_id : rows[0].session_id
        inserts.push({ table, sessionId, count: rows.length })
        if (table === 'final_event_log') {
          assert.equal(gates.has(sessionId), false, '同一 session 只能写入一次最终事件')
          const gate = deferred()
          gates.set(sessionId, gate)
          observe()
          if (!releaseAll) await gate.promise
          finalEvents.push(...rows)
        } else if (table === 'event_attribution') attributions.push(...rows)
        else throw new Error(`未预期的表：${table}`)
      },
    }
    const config = { get: key => ({
      'master.host': 'test-master', 'master.port': '8105',
      'node.heartbeatIntervalMs': 60000, 'node.logFlushIntervalMs': 60000,
      'nodeControl.heartbeatTimeoutMs': 60000,
    })[key] }
    computeNode = new ComputeNodeService(clickhouse, undefined, pool)
    computeNode.nodeId = 'node-concurrency-acceptance'
    computeNode.nodeName = '并发验收节点'
    registry = new NodeRegistryService(new RegisteredNodeService(registeredNodeRepository()), config)
    scheduler = new CleaningSchedulerService(registry, clickhouse, {}, { find: async () => [] })
    registry.onModuleInit()
    scheduler.onModuleInit()
    const bridge = createProtoBridge(registry, observe)
    class BridgedConnection extends NodeConnectionService {
      createCall() { return bridge.call }
    }
    connection = new BridgedConnection(computeNode, config)
    connection.onApplicationBootstrap()
    await waitFor(() => connection.linkStatus === 'connected', '节点应通过异步 proto ACK 完成注册')
    assert.equal(bridge.upstream.find(frame => frame.register).register.info.task_capacity, 3)

    assert.deepEqual(await scheduler.cleanNow(date), { dispatched: 0, pending: 0, loading: true, waitingForCapacity: false })
    await waitFor(() => gates.size === 3, '首批三个小 session 应同时计算并阻塞在落库')
    assert.equal(scheduler.queue.size, 4)
    assert.equal(workers.length, 3)
    assert.equal(new Set(workers.map(worker => worker.threadId)).size, 3)
    assert.ok(workers.every(worker => worker.threadId > 0))
    assert.equal(bridge.downstream.filter(frame => frame.task).length, 3)
    assert.equal(computeNode.activeTaskCount, 3)
    assert.equal(scheduler.inflight.size, 3)
    assert.equal(registry.pickIdleNode(), null)
    assert.ok([...eventLists.values()].every(events => events.length < 1000))
    const busyTopology = await registry.getTopology()
    assert.equal(busyTopology.nodes[0].activeTaskCount, 3)
    assert.ok(busyTopology.nodes[0].cleaningSpeed.current > 0, '毫秒级小 session 的真实进度应显示节点实时速度')

    connection.sendRegister()
    await waitFor(() => bridge.upstream.filter(frame => frame.register).length === 2, '繁忙心跳应已发送')
    const busyInfo = bridge.upstream.filter(frame => frame.register).at(-1).register.info
    assert.equal(busyInfo.task_capacity, 3)
    assert.deepEqual(new Set(busyInfo.active_task_ids), new Set(computeNode.currentTaskIds))

    // 释放任意一个已到落库阶段的任务，另两个仍阻塞，必须立即补上第四个。
    const released = new Set()
    const firstReleased = [...gates.keys()][1]
    released.add(firstReleased)
    gates.get(firstReleased).resolve()
    await waitFor(() => gates.size === 4, '完成任意一个任务后应立即补发第四个')
    assert.equal(finalEvents.filter(event => event.$session_id === firstReleased).length, eventLists.get(firstReleased).length)
    assert.equal(bridge.downstream.filter(frame => frame.task).length, 4)
    assert.equal(computeNode.activeTaskCount, 3)
    assert.equal(registry.nodes.get(computeNode.nodeId).activeTasks.size, 3)
    assert.equal(scheduler.queue.size, 3)
    assert.equal(gates.size - released.size, 3)
    assert.equal(workers.length, 3)
    const refilledTopology = await registry.getTopology()
    assert.ok(refilledTopology.nodes[0].cleaningSpeed.current > 0, '补位后仍应保留节点滚动速度')

    while (released.size < sessions.length) {
      const sessionId = [...gates.keys()].find(id => !released.has(id))
      assert.ok(sessionId, '应存在一个等待落库的任务供释放')
      released.add(sessionId)
      gates.get(sessionId).resolve()
      const nextStartedCount = Math.min(sessions.length, released.size + 3)
      await waitFor(() => gates.size >= nextStartedCount, '空闲槽位应持续被下一 session 补满')
    }
    await waitFor(() => scheduler.inflight.size === 0 && computeNode.activeTaskCount === 0, '全部任务应完成并清空在途状态')
    observe()

    const dispatched = bridge.downstream.filter(frame => frame.task).map(frame => frame.task)
    const terminal = bridge.upstream.filter(frame => frame.progress?.completed || frame.progress?.failed)
    assert.equal(dispatched.length, 7)
    assert.equal(new Set(dispatched.map(task => task.task_id)).size, 7)
    assert.deepEqual(new Set(dispatched.map(task => task.session_id)), new Set(sessions))
    assert.ok(dispatched.every(task => task.date === date))
    assert.equal(terminal.length, 7)
    assert.ok(terminal.every(frame => frame.progress.completed && !frame.progress.failed))
    assert.deepEqual(new Set(terminal.map(frame => frame.progress.task_id)), new Set(dispatched.map(task => task.task_id)))
    const sortAttributions = rows => [...rows].sort((a, b) => `${a.event_id}|${a.attr_key}`.localeCompare(`${b.event_id}|${b.attr_key}`))
    for (const sessionId of sessions) {
      assert.deepEqual(finalEvents.filter(event => event.$session_id === sessionId), expected.get(sessionId).finalEvents)
      assert.deepEqual(sortAttributions(attributions.filter(row => row.session_id === sessionId)), sortAttributions(expected.get(sessionId).attributions))
      assert.equal(inserts.filter(insert => insert.table === 'final_event_log' && insert.sessionId === sessionId).length, 1)
      assert.equal(inserts.filter(insert => insert.table === 'event_attribution' && insert.sessionId === sessionId).length, 1)
    }
    assert.equal(new Set(finalEvents.map(event => event.$event_id)).size, finalEvents.length)
    assert.equal(scheduler.queue.size, 0)
    assert.equal(scheduler.dispatchedTasks.size, 0)
    assert.equal(scheduler.retryBases.size, 0)
    assert.equal(scheduler.attempts.size, 0)
    assert.equal(scheduler.loadedRuns.size, 0)
    assert.equal(computeNode.queuedTasks.length, 0)
    assert.equal(computeNode.runningSlices.size, 0)
    assert.equal(computeNode.runningTaskCount, 0)
    assert.equal(registry.nodes.get(computeNode.nodeId).activeTasks.size, 0)
    assert.equal(pool.queue.length, 0)
    assert.ok([...pool.workers].every(slot => !slot.current))
    assert.equal(workers.length, 3, '七个 session 应复用首批创建的三个真实线程')
    assert.ok(occupancy.some(sample => sample.registryCount === 3 && sample.nodeCount === 3))
    const topology = await registry.getTopology()
    assert.equal(topology.nodes[0].taskCapacity, 3)
    assert.equal(topology.nodes[0].activeTaskCount, 0)
    assert.deepEqual(topology.nodes[0].busyTaskIds, [])
    assert.equal(topology.nodes[0].cleaningSpeed.current, null, '空闲节点实时速度应显示横线')
  } finally {
    releaseAll = true
    for (const gate of gates.values()) gate.resolve()
    connection?.onModuleDestroy()
    scheduler?.onModuleDestroy()
    registry?.onModuleDestroy()
    await pool?.onModuleDestroy()
    rmSync(directory, { recursive: true, force: true })
    console.log = originalLog
    console.warn = originalWarn
    Logger.overrideLogger(['log', 'warn', 'error', 'debug', 'verbose', 'fatal'])
  }
})
