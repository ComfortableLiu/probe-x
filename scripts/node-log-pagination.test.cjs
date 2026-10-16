const assert = require('node:assert/strict')
const { test } = require('node:test')
const keySlot = require('cluster-key-slot')
require('reflect-metadata')
require('ts-node').register({ transpileOnly: true, skipProject: true, compilerOptions: {
  target: 'ES2022', module: 'CommonJS', moduleResolution: 'node', experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true,
} })
const {
  appendNodeLogs, readNodeLogPage, readNodeLogs, InvalidNodeLogQueryError,
  nodeLogsKey, nodeLogsMetaKey, NODE_LOGS_MAX_ENTRIES, NODE_LOGS_TTL_SECONDS,
} = require('../libs/shared-utils/src/lib/backend-common/node-logs.ts')
const { NodeRegistryService } = require('../apps/data-dashboard-api-service/src/api/compute-node/node-registry.service.ts')
const { SystemDataController } = require('../apps/data-dashboard-api-service/src/api/system-data/system-data.controller.ts')

/** 无网络 IO 的 Redis 原子操作契约桩；列表可在两次调用之间追加/到期。 */
class MemoryRedis {
  status = 'ready'
  lists = new Map()
  metadata = new Map()
  ttl = new Map()
  appendBatchSizes = []
  readResultCounts = []
  async eval(script, count, listKey, metadataKey, candidateEpoch, ttl, ...args) {
    assert.equal(count, 2)
    assert.match(script, /redis\.call\('LLEN', KEYS\[1\]\)/)
    assert.match(script, /redis\.call\('HMGET', KEYS\[2\], 'epoch', 'tail'\)/)
    let list = this.lists.get(listKey) || []
    let metadata = this.metadata.get(metadataKey)
    if (!list.length || !metadata || metadata.tail < list.length) {
      metadata = { epoch: candidateEpoch, tail: list.length }
      if (list.length) {
        this.metadata.set(metadataKey, metadata)
        this.ttl.set(metadataKey, this.ttl.get(listKey) ?? Number(ttl))
      }
    }
    if (script.startsWith('-- probe-x:append-node-logs-v2')) {
      assert.doesNotMatch(script, /unpack\(/)
      assert.match(script, /redis\.call\('LTRIM'/)
      const [max, ...entries] = args
      this.appendBatchSizes.push(entries.length)
      list = list.concat(entries).slice(-Number(max))
      metadata.tail += entries.length
      this.lists.set(listKey, list)
      this.metadata.set(metadataKey, metadata)
      this.ttl.set(listKey, Number(ttl))
      this.ttl.set(metadataKey, Number(ttl))
      return 1
    }
    assert.ok(script.startsWith('-- probe-x:read-node-log-page-v2'))
    assert.match(script, /offset - 127/)
    assert.match(script, /pcall\(cjson.decode/)
    const [epoch, beforeRaw, limitRaw, level] = args
    const before = Number(beforeRaw)
    const limit = Number(limitRaw)
    const head = metadata.tail - list.length + 1
    if (epoch && (!list.length || epoch !== metadata.epoch || before <= head || before > metadata.tail + 1)) {
      return ['reset', metadata.epoch]
    }
    const result = ['ok', metadata.epoch, String(metadata.tail + 1)]
    for (let index = epoch ? before - head - 1 : list.length - 1; index >= 0; index--) {
      try {
        const entry = JSON.parse(list[index])
        if (!entry || !Number.isFinite(entry.ts) || typeof entry.message !== 'string'
          || !['log', 'info', 'warn', 'error', 'debug'].includes(entry.level)) continue
        if (level !== 'all' && entry.level !== level && !(level === 'log' && entry.level === 'info')) continue
        result.push(list[index], String(head + index))
        if ((result.length - 3) / 2 > limit) break
      } catch { /* 脏记录不占用页大小。 */ }
    }
    this.readResultCounts.push((result.length - 3) / 2)
    return result
  }
  async lrange(key, start, stop) {
    const list = this.lists.get(key) || []
    return list.slice(start, stop === -1 ? undefined : stop + 1)
  }
  expireNode(nodeId) {
    this.lists.delete(nodeLogsKey(nodeId))
    this.metadata.delete(nodeLogsMetaKey(nodeId))
  }
}
const logs = (start, count, level = 'log') => Array.from({ length: count }, (_, offset) => ({
  ts: 100000 + start + offset,
  level,
  message: `event-${start + offset}`,
}))
const messages = page => page.entries.map(entry => entry.message)
const registry = redis => new NodeRegistryService({}, {}, { getClient: () => redis })

test('Redis Cluster 下列表和元数据在同一槽，兼容普通/已有 tag/空 tag/孤立花括号节点名', () => {
  for (const nodeId of ['node', 'node:1', 'node-{tenant-a}', '中文-节点', 'node{nested{tag}}']) {
    assert.equal(keySlot(nodeLogsMetaKey(nodeId)), keySlot(nodeLogsKey(nodeId)))
  }
  for (const nodeId of ['node{}', 'node{}{tag}', '}node', 'node{', 'node{}-中文']) {
    const key = nodeLogsKey(nodeId)
    // 空首个 tag 应按 Redis 规范散列全 key。+256 不改变 CRC 的低字节，
    // 同时避开 cluster-key-slot 1.1.2 对空 tag 后再含 } 的已知解析差异。
    const fullKeySlot = keySlot(Array.from(Buffer.from(key), byte => byte + 256))
    assert.equal(keySlot(nodeLogsMetaKey(nodeId)), fullKeySlot)
    assert.equal(nodeLogsMetaKey(nodeId), nodeLogsMetaKey(nodeId))
  }
})

test('默认只读取最新 100 条，提供稳定页面锚点和更早页游标', async () => {
  const redis = new MemoryRedis()
  await appendNodeLogs(redis, 'node', logs(1, 350))
  const page = await readNodeLogPage(redis, 'node')
  assert.deepEqual(messages(page), logs(251, 100).map(entry => entry.message))
  assert.equal(page.hasMore, true)
  assert.equal(page.retentionLimit, 2000)
  assert.ok(page.nextCursor)
  assert.ok(page.pageCursor)
  assert.equal(new Set(page.entries.map(entry => entry.id)).size, 100)
  assert.equal(redis.readResultCounts.at(-1), 101)
})

test('逐页覆盖留存列表且尾页不返回额外游标，页间无重无漏', async () => {
  const redis = new MemoryRedis()
  await appendNodeLogs(redis, 'node', logs(1, 530))
  const pages = []
  let cursor
  do {
    const page = await readNodeLogPage(redis, 'node', { limit: 200, cursor })
    pages.unshift(...page.entries)
    cursor = page.nextCursor ?? undefined
    assert.equal(page.hasMore, !!cursor)
    assert.ok(page.entries.length <= 200)
  } while (cursor)
  assert.deepEqual(pages.map(entry => entry.message), logs(1, 530).map(entry => entry.message))
  assert.equal(new Set(pages.map(entry => entry.id)).size, 530)
})

test('追加新日志及 LTRIM 后历史页位置保持不变，返回原最新页也不会跳动', async () => {
  const redis = new MemoryRedis()
  await appendNodeLogs(redis, 'node', logs(1, 2000))
  const first = await readNodeLogPage(redis, 'node')
  await appendNodeLogs(redis, 'node', logs(2001, 40))
  const second = await readNodeLogPage(redis, 'node', { cursor: first.nextCursor })
  assert.deepEqual(messages(second), logs(1801, 100).map(entry => entry.message))
  assert.deepEqual((await readNodeLogPage(redis, 'node', { cursor: first.pageCursor })).entries, first.entries)
  assert.deepEqual(messages(await readNodeLogPage(redis, 'node')), logs(1941, 100).map(entry => entry.message))
  assert.equal(redis.lists.get(nodeLogsKey('node')).length, NODE_LOGS_MAX_ENTRIES)
})

test('服务端先筛选再分页，普通日志包含 info，稀疏错误仍能跨块加载', async () => {
  const redis = new MemoryRedis()
  const entries = logs(1, 1800).map((entry, index) => ({ ...entry, level: index % 200 === 0 ? 'error' : index % 2 ? 'log' : 'info' }))
  await appendNodeLogs(redis, 'node', entries)
  const first = await readNodeLogPage(redis, 'node', { level: 'error', limit: 3 })
  const second = await readNodeLogPage(redis, 'node', { level: 'error', limit: 3, cursor: first.nextCursor })
  assert.deepEqual(messages(first), ['event-1201', 'event-1401', 'event-1601'])
  assert.deepEqual(messages(second), ['event-601', 'event-801', 'event-1001'])
  assert.equal(redis.readResultCounts.at(-1), 4)
  const ordinary = await readNodeLogPage(redis, 'node', { level: 'log', limit: 200 })
  assert.equal(ordinary.entries.length, 200)
  assert.deepEqual(new Set(ordinary.entries.map(entry => entry.level)), new Set(['log', 'info']))
  await assert.rejects(readNodeLogPage(redis, 'node', { level: 'warn', cursor: first.nextCursor }), InvalidNodeLogQueryError)
})

test('无日志、没有匹配级别、恰好满页和相同时间戳日志都有准确边界', async () => {
  const redis = new MemoryRedis()
  assert.deepEqual(await readNodeLogPage(redis, 'node'), {
    nodeId: 'node', entries: [], pageCursor: null, nextCursor: null, hasMore: false, retentionLimit: 2000,
  })
  await appendNodeLogs(redis, 'node', logs(1, 100).map(entry => ({ ...entry, ts: 123 })))
  const page = await readNodeLogPage(redis, 'node')
  assert.equal(page.entries.length, 100)
  assert.equal(page.hasMore, false)
  assert.equal(page.nextCursor, null)
  assert.equal(new Set(page.entries.map(entry => entry.id)).size, 100)
  const empty = await readNodeLogPage(redis, 'node', { level: 'error' })
  assert.equal(empty.pageCursor, null)
  assert.equal(empty.hasMore, false)
})

test('旧列表补齐 metadata；坏 JSON 和不合法日志不占用页大小', async () => {
  const redis = new MemoryRedis()
  const key = nodeLogsKey('legacy')
  redis.lists.set(key, [JSON.stringify(logs(1, 1)[0]), '{', JSON.stringify({ ts: 1, level: 'bad', message: 'bad' }), JSON.stringify(logs(2, 1)[0])])
  redis.ttl.set(key, 60)
  const page = await readNodeLogPage(redis, 'legacy', { limit: 1 })
  assert.deepEqual(messages(page), ['event-2'])
  assert.equal(redis.ttl.get(nodeLogsMetaKey('legacy')), 60)
  await appendNodeLogs(redis, 'legacy', logs(3, 1))
  assert.deepEqual(messages(await readNodeLogPage(redis, 'legacy', { limit: 1, cursor: page.nextCursor })), ['event-1'])
  assert.equal(redis.ttl.get(key), NODE_LOGS_TTL_SECONDS)
  assert.equal(redis.metadata.get(nodeLogsMetaKey('legacy')).tail, 5)
})

test('TTL 重置及目标历史完全被裁剪均明确要求重置，不串入新周期', async () => {
  const redis = new MemoryRedis()
  await appendNodeLogs(redis, 'node', logs(1, 250))
  const page = await readNodeLogPage(redis, 'node')
  redis.expireNode('node')
  assert.equal((await readNodeLogPage(redis, 'node', { cursor: page.nextCursor })).resetRequired, true)
  await appendNodeLogs(redis, 'node', logs(10000, 250))
  const reset = await readNodeLogPage(redis, 'node', { cursor: page.nextCursor })
  assert.equal(reset.resetRequired, true)
  assert.deepEqual(reset.entries, [])
  assert.equal(reset.hasMore, false)
  const fresh = await readNodeLogPage(redis, 'node')
  await appendNodeLogs(redis, 'node', logs(20000, 2200))
  assert.equal((await readNodeLogPage(redis, 'node', { cursor: fresh.nextCursor })).resetRequired, true)
})

test('恶意或错误游标、跨节点游标、无效级别及页大小在访问 Redis 前拒绝', async () => {
  const redis = new MemoryRedis()
  await appendNodeLogs(redis, 'node', logs(1, 201))
  const page = await readNodeLogPage(redis, 'node')
  for (const query of [
    { limit: 0 }, { limit: -1 }, { limit: 201 }, { limit: 1.2 }, { limit: NaN }, { limit: Infinity },
    { cursor: '' }, { cursor: '%%%bad' }, { cursor: 'e30' }, { cursor: 'a'.repeat(2049) },
    { level: 'info' }, { level: ['warn'] },
  ]) await assert.rejects(readNodeLogPage(redis, 'node', query), InvalidNodeLogQueryError)
  await assert.rejects(readNodeLogPage(redis, 'other-node', { cursor: page.nextCursor }), InvalidNodeLogQueryError)
})

test('超量追加分成有限参数批次，留存仍为 2000 且所有序号均递增', async () => {
  const redis = new MemoryRedis()
  await appendNodeLogs(redis, 'node', logs(1, 50000))
  assert.equal(redis.appendBatchSizes.length, 250)
  assert.ok(redis.appendBatchSizes.every(size => size <= 200))
  assert.equal(redis.metadata.get(nodeLogsMetaKey('node')).tail, 50000)
  assert.equal(redis.lists.get(nodeLogsKey('node')).length, 2000)
  assert.deepEqual(messages(await readNodeLogPage(redis, 'node', { limit: 1 })), ['event-50000'])
})

test('Redis 未就绪/读取失败不返回假空页；旧 readNodeLogs 调用保持兼容', async () => {
  const redis = new MemoryRedis()
  await appendNodeLogs(redis, 'node', logs(1, 10))
  assert.deepEqual(await readNodeLogs(redis, 'node', 3), logs(8, 3))
  redis.status = 'reconnecting'
  await assert.rejects(readNodeLogPage(redis, 'node'), /未就绪/)
  await assert.rejects(appendNodeLogs(redis, 'node', logs(11, 1)), /未就绪/)
  await assert.rejects(registry(redis).getNodeLogPage('node'), error => error.getStatus() === 503)
  await assert.rejects(new NodeRegistryService({}, {}).getNodeLogPage('node'), error => error.getStatus() === 503)
  redis.status = 'ready'
  redis.eval = async () => { throw new Error('Redis unavailable') }
  await assert.rejects(registry(redis).getNodeLogPage('node'), error => error.getStatus() === 503)
})

test('控制器默认分页并传递过滤/游标；无效参数返回 HTTP 400', async () => {
  const redis = new MemoryRedis()
  await appendNodeLogs(redis, 'node', logs(1, 230))
  const controller = new SystemDataController({}, {}, {}, registry(redis))
  const page = await controller.getComputingNodeLogs('node')
  assert.equal(page.entries.length, 100)
  const next = await controller.getComputingNodeLogs('node', '10', page.nextCursor, 'all')
  assert.deepEqual(messages(next), logs(121, 10).map(entry => entry.message))
  for (const limit of ['0', '201', 'bad', '1.5', '']) {
    await assert.rejects(controller.getComputingNodeLogs('node', limit), error => error.getStatus() === 400)
  }
  await assert.rejects(controller.getComputingNodeLogs('node', undefined, 'bad'), error => error.getStatus() === 400)
  await assert.rejects(controller.getComputingNodeLogs('node', undefined, undefined, 'invalid'), error => error.getStatus() === 400)
})
