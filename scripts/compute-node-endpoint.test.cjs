const assert = require('node:assert/strict')
const { test, afterEach } = require('node:test')
const { EventEmitter } = require('node:events')
const { resolve } = require('node:path')
const { setImmediate: nextTurn } = require('node:timers/promises')
const protoLoader = require('@grpc/proto-loader')
const { Subject } = require('rxjs')
require('reflect-metadata')
require('ts-node').register({ transpileOnly: true, skipProject: true, compilerOptions: {
  target: 'ES2022', module: 'CommonJS', moduleResolution: 'node', experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true,
} })

const { parsePeerAddress, reportedNodePort } = require('../apps/data-dashboard-api-service/src/api/compute-node/node-endpoint.ts')
const { ComputeNodeService } = require('../apps/data-dashboard-api-service/src/api/compute-node/compute-node.service.ts')
const { NodeRegistryService } = require('../apps/data-dashboard-api-service/src/api/compute-node/node-registry.service.ts')
const { NodeControlController } = require('../apps/data-dashboard-api-service/src/api/compute-node/node-control.controller.ts')

const proto = protoLoader.loadSync(resolve(__dirname, '../libs/shared-utils/src/lib/backend-common/proto/final_data_cleaning_control_bi_stream.proto'), {
  keepCase: true, longs: String, enums: String, defaults: true, oneofs: true,
})
const connectMethod = proto['final_data_cleaning_control_bi_stream.NodeControlService'].Connect
const fixtures = new Set()
afterEach(() => { for (const fixture of fixtures) fixture.close(); fixtures.clear() })

function deferred() {
  let resolvePromise
  const promise = new Promise(resolveValue => { resolvePromise = resolveValue })
  return { promise, resolve: resolvePromise }
}

async function settleWrites() { await nextTurn(); await nextTurn() }

/** 保留真实 controller/registry/service，只替换数据库 repository 与网络 call。 */
function createFixture({ seed = [], beforeSave } = {}) {
  const rows = new Map(seed.map((row, index) => [row.id || index + 1, { id: index + 1, ...row }]))
  const saves = []
  let saving = 0
  let maximumSaving = 0
  let nextId = Math.max(0, ...rows.keys()) + 1
  const repository = {
    async findOne({ where }) {
      const row = where.nodeId === undefined ? rows.get(where.id) : [...rows.values()].find(item => item.nodeId === where.nodeId)
      return row ? { ...row } : null
    },
    create: input => ({ ...input }),
    async save(entity) {
      saves.push({ ...entity })
      saving++
      maximumSaving = Math.max(maximumSaving, saving)
      try {
        await beforeSave?.(entity, saves.length)
        const id = entity.id || nextId++
        if (entity.nodeId && [...rows.values()].some(row => row.nodeId === entity.nodeId && row.id !== id)) {
          throw new Error('Duplicate node_id')
        }
        const row = { createdAt: new Date(0), updatedAt: new Date(0), ...entity, id }
        rows.set(id, row)
        return { ...row }
      } finally { saving-- }
    },
    async update({ nodeId }, patch) {
      const row = [...rows.values()].find(item => item.nodeId === nodeId)
      if (row) Object.assign(row, patch)
    },
    createQueryBuilder() {
      let registeredOnly = false
      const selected = () => [...rows.values()].filter(row => !registeredOnly || row.nodeId)
      const builder = {
        where: () => { registeredOnly = true; return builder },
        orderBy: () => builder,
        getMany: async () => selected().map(row => ({ ...row })),
      }
      return builder
    },
  }
  const service = new ComputeNodeService(repository)
  const registry = new NodeRegistryService(service, { get: () => undefined })
  const controller = new NodeControlController(registry)
  const streams = []
  const fixture = {
    rows, saves, service, registry,
    get maximumSaving() { return maximumSaving },
    row: () => [...rows.values()].find(row => row.nodeId === 'node-1'),
    async topology() { return (await registry.getTopology()).nodes.find(node => node.nodeId === 'node-1') },
    async bind(peer = '192.0.2.10:54321', { noGetPeer = false, peerError } = {}) {
      const inbound = new Subject()
      const call = new EventEmitter()
      if (!noGetPeer) call.getPeer = () => { if (peerError) throw peerError; return peer }
      const frames = []
      const subscription = (await controller.connect(inbound, undefined, call)).subscribe(frame => frames.push(frame))
      const stream = {
        frames,
        register(patch = {}) {
          const frame = { register: {
            node_id: 'node-1', node_name: 'Endpoint test node', node_address: '', version: 'rust-test',
            info: { available: true, task_capacity: 1, cpu_count: 1, active_task_ids: [] },
            ...patch,
          } }
          // 新 proto 的默认值也是旧客户端省略字段时服务端实际看到的 0/空字符串。
          inbound.next(connectMethod.requestDeserialize(connectMethod.requestSerialize(frame)))
        },
        close() { call.emit('close'); inbound.complete(); subscription.unsubscribe() },
      }
      streams.push(stream)
      return stream
    },
    close() { streams.forEach(stream => stream.close()); registry.onModuleDestroy() },
  }
  fixtures.add(fixture)
  return fixture
}

test('peer IPv4/IPv6/mapped IP 规范化，只返回连接来源 IP', () => {
  for (const [peer, expected] of [
    ['192.0.2.10:54321', '192.0.2.10'],
    ['ipv4:192.0.2.10:54321', '192.0.2.10'],
    ['127.0.0.1', '127.0.0.1'],
    ['[2001:0DB8:0:0:0:0:0:7]:54321', '2001:db8::7'],
    ['ipv6:[2001:db8::7]:54321', '2001:db8::7'],
    ['2001:db8::7:54321', '2001:db8::7'],
    ['::1:1234', '::1'],
    ['::1', '::1'],
    ['::ffff:192.0.2.10:54321', '192.0.2.10'],
    ['[::ffff:c000:20a]:54321', '192.0.2.10'],
    ['::ffff:192.0.2.10', '192.0.2.10'],
  ]) assert.equal(parsePeerAddress(peer), expected, peer)
  for (const peer of [undefined, null, 123, '', 'unknown', 'localhost:54321', 'unix:/tmp/socket', '192.0.2.10:65536', '[::1]:0', '[::1]:abc']) {
    assert.equal(parsePeerAddress(peer), undefined, String(peer))
  }
})

test('只有有效的 1..65535 上报端口能替换已有监听端口', () => {
  for (const port of [1, 10001, 65535]) assert.equal(reportedNodePort(port), port)
  for (const port of [undefined, null, 0, -1, 65536, 10000.5, '10000', NaN, Infinity]) assert.equal(reportedNodePort(port), undefined)
})

test('真实控制器以 peer IP 补空地址，临时源端口绝不落库或变成健康端口', async () => {
  const fixture = createFixture()
  const connection = await fixture.bind('::ffff:192.0.2.10:54321')
  connection.register()
  await settleWrites()
  assert.equal(connection.frames[0].ack.accepted, true)
  assert.equal(fixture.row().nodeAddress, '192.0.2.10')
  assert.equal(fixture.row().nodePort, 0)
  const topology = await fixture.topology()
  assert.equal(topology.nodeAddress, '192.0.2.10')
  assert.equal(topology.nodePort, 0)
  assert.equal(topology.healthHost, undefined)
  assert.equal(topology.healthPort, undefined)
})

test('显式注册地址和对外端口优先，实际 loopback 健康绑定保持独立', async () => {
  const fixture = createFixture()
  await (await fixture.bind()).register({ node_address: 'node.example.test', node_port: 18080, health_host: '127.0.0.1', health_port: 10001 })
  await settleWrites()
  assert.equal(fixture.row().nodeAddress, 'node.example.test')
  assert.equal(fixture.row().nodePort, 18080)
  const topology = await fixture.topology()
  assert.equal(topology.nodeAddress, 'node.example.test')
  assert.equal(topology.nodePort, 18080)
  assert.equal(topology.healthHost, '127.0.0.1')
  assert.equal(topology.healthPort, 10001)
})

test('绑定后补报及变更地址/端口会持久化，重复心跳不重复写数据库', async () => {
  const fixture = createFixture()
  const connection = await fixture.bind()
  connection.register()
  await settleWrites()
  connection.register({ node_address: 'first.example.test', node_port: 10001, health_host: '127.0.0.1', health_port: 10001 })
  await settleWrites()
  connection.register({ node_address: 'second.example.test', node_port: 10002, health_host: '::', health_port: 10002 })
  await settleWrites()
  const saves = fixture.saves.length
  connection.register({ node_address: 'second.example.test', node_port: 10002, health_host: '::', health_port: 10002 })
  await settleWrites()
  assert.equal(fixture.saves.length, saves)
  assert.equal(fixture.row().nodeAddress, 'second.example.test')
  assert.equal(fixture.row().nodePort, 10002)
  const topology = await fixture.topology()
  assert.equal(topology.healthHost, '::')
  assert.equal(topology.healthPort, 10002)
})

test('旧协议和 0/非法端口不覆盖本流已经知道的有效端口', async () => {
  const fixture = createFixture()
  const connection = await fixture.bind()
  connection.register({ node_port: 10001, health_host: '0.0.0.0', health_port: 10001 })
  await settleWrites()
  for (const patch of [{}, { node_port: 0 }, { node_port: -1 }, { node_port: 65536 }]) {
    connection.register(patch)
    await settleWrites()
    assert.equal(fixture.row().nodePort, 10001)
    assert.equal((await fixture.topology()).nodePort, 10001)
  }
})

test('总服务重启后旧客户端未报端口，在线及离线列表保留数据库已知端口', async () => {
  const fixture = createFixture({ seed: [{
    id: 1, nodeId: 'node-1', nodeName: 'Previous node', nodeAddress: '192.0.2.2', nodePort: 18080,
    nodeType: 'grpc', status: 'stopped', weight: 100,
  }] })
  await (await fixture.bind('192.0.2.10:54321')).register()
  await settleWrites()
  assert.equal(fixture.row().nodePort, 18080)
  const topology = await fixture.topology()
  assert.equal(topology.nodePort, 18080)
  assert.equal(topology.healthPort, undefined, '历史声明端口不能冒充实际监听端口')
  const offline = new NodeRegistryService(fixture.service, { get: () => undefined })
  const saved = (await offline.getTopology()).nodes[0]
  assert.equal(saved.link, 'disconnected')
  assert.equal(saved.nodePort, 18080)
  assert.equal(saved.healthHost, undefined)
  assert.equal(saved.healthPort, undefined)
})

test('重连更新 peer IP 和监听端口，并丢弃未重新上报的旧实际绑定信息', async () => {
  const fixture = createFixture()
  await (await fixture.bind('192.0.2.10:54321')).register({ node_port: 10001, health_host: '127.0.0.1', health_port: 10001 })
  await settleWrites()
  await (await fixture.bind('[2001:db8::9]:55555')).register({ node_port: 10002 })
  await settleWrites()
  assert.equal(fixture.rows.size, 1)
  assert.equal(fixture.row().nodeAddress, '2001:db8::9')
  assert.equal(fixture.row().nodePort, 10002)
  const topology = await fixture.topology()
  assert.equal(topology.healthHost, undefined)
  assert.equal(topology.healthPort, undefined)
})

test('传输层不提供或无法读取 getPeer 时仍可按显式地址注册', async () => {
  for (const options of [{ noGetPeer: true }, { peerError: new Error('Transport closed') }]) {
    const fixture = createFixture()
    await (await fixture.bind(undefined, options)).register({ node_address: 'configured.example.test', node_port: 10001 })
    await settleWrites()
    assert.equal(fixture.row().nodeAddress, 'configured.example.test')
    assert.equal(fixture.row().nodePort, 10001)
  }
})

test('首次 0 端口与连续实际端口补报仅保留一个进行中写入和最新快照', async () => {
  const firstSave = deferred()
  const fixture = createFixture({ beforeSave: async (_, call) => { if (call === 1) await firstSave.promise } })
  const connection = await fixture.bind()
  connection.register()
  await nextTurn()
  try {
    for (let index = 0; index < 20; index++) connection.register({ node_port: 12000 + index, health_host: '::', health_port: 12000 + index })
    assert.equal(fixture.saves.length, 1)
    assert.equal(fixture.maximumSaving, 1)
  } finally { firstSave.resolve() }
  await settleWrites()
  assert.equal(fixture.rows.size, 1)
  assert.equal(fixture.saves.length, 2, '快速补报应合并为最后一次更新')
  assert.equal(fixture.maximumSaving, 1)
  assert.equal(fixture.row().nodePort, 12019)
  assert.equal((await fixture.topology()).healthPort, 12019)
})

test('注册写库失败允许相同心跳重试，旧失败不会撤销更新成功的最新快照', async () => {
  let fail = true
  const fixture = createFixture({ beforeSave: async () => { if (fail) { fail = false; throw new Error('Temporary database failure') } } })
  const connection = await fixture.bind()
  connection.register({ node_port: 10001 })
  await settleWrites()
  assert.equal(fixture.rows.size, 0)
  connection.register({ node_port: 10001 })
  await settleWrites()
  assert.equal(fixture.row().nodePort, 10001)

  const slowFailure = deferred()
  const coalesced = createFixture({ beforeSave: async (_, call) => {
    if (call === 1) { await slowFailure.promise; throw new Error('First snapshot failed') }
  } })
  const updating = await coalesced.bind()
  updating.register({ node_port: 10001 })
  await nextTurn()
  updating.register({ node_port: 10002 })
  slowFailure.resolve()
  await settleWrites()
  assert.equal(coalesced.row().nodePort, 10002)
  const saves = coalesced.saves.length
  updating.register({ node_port: 10002 })
  await settleWrites()
  assert.equal(coalesced.saves.length, saves)
})
