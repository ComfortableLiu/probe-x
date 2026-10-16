const assert = require('node:assert/strict')
const { test } = require('node:test')
const { Readable } = require('node:stream')
const { setImmediate: nextTurn } = require('node:timers/promises')
const { ResultSet } = require('@clickhouse/client/dist/result_set')

require('reflect-metadata')
require('ts-node').register({ transpileOnly: true, skipProject: true, compilerOptions: {
  target: 'ES2022', module: 'CommonJS', moduleResolution: 'node', experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true,
} })
const { ClickHouseService } = require('../libs/shared-utils/src/lib/backend-common/modules/clickhouse/clickhouse.service.ts')

test('有界查询保留查询参数、资源限制与取消信号', async () => {
  const calls = []
  const rows = [{ id: 1 }]
  const service = new ClickHouseService({ query: async options => {
    calls.push(options)
    return { json: async () => rows }
  } })
  const controller = new AbortController()
  const settings = { max_memory_usage: 268435456, max_threads: 2, max_execution_time: 30 }
  assert.equal(await service.query('SELECT id LIMIT {limit:UInt32}', { limit: 1 }, settings, controller.signal), rows)
  assert.deepEqual(calls, [{
    query: 'SELECT id LIMIT {limit:UInt32}', query_params: { limit: 1 }, format: 'JSONEachRow',
    clickhouse_settings: settings, abort_signal: controller.signal,
  }])
})

/** 使用已安装客户端的真实解析/取消逻辑，仅把 HTTP 响应替换成内存 Readable。 */
function setup(source) {
  const result = new ResultSet(source, 'JSONEachRow', 'memory-query', () => {})
  const close = result.close.bind(result)
  let closed = 0
  result.close = () => { closed++; close() }
  const calls = []
  const service = new ClickHouseService({ query: async options => { calls.push(options); return result } })
  return { service, calls, get closed() { return closed }, result }
}

test('queryBatches 逐批解析 JSONEachRow 并保留查询参数，完成后关闭结果', async () => {
  const source = Readable.from([
    Buffer.from('{"id":1}\n{"id":2}\n'),
    Buffer.from('{"id":3}\n'),
  ])
  const state = setup(source)
  const batches = []
  for await (const batch of state.service.queryBatches('SELECT id WHERE id > {min:UInt64}', { min: 0 })) {
    batches.push(batch)
  }
  assert.deepEqual(batches, [[{ id: 1 }, { id: 2 }], [{ id: 3 }]])
  assert.deepEqual(state.calls, [{ query: 'SELECT id WHERE id > {min:UInt64}', query_params: { min: 0 }, format: 'JSONEachRow' }])
  assert.equal(state.closed, 1)
  assert.equal(source.destroyed, true)
})

test('queryBatches 空结果仍释放响应流', async () => {
  const source = Readable.from([])
  const state = setup(source)
  const batches = []
  for await (const batch of state.service.queryBatches('SELECT empty')) batches.push(batch)
  assert.deepEqual(batches, [])
  assert.equal(state.closed, 1)
  assert.equal(source.destroyed, true)
})

test('调用方提前 break 取消未结束的查询流，不再等待剩余响应', async () => {
  let started = false
  const source = new Readable({
    read() {
      if (started) return
      started = true
      this.push(Buffer.from('{"id":1}\n'))
      // 保持响应未结束：early break 必须主动取消，不能依赖正常 EOF。
    },
  })
  const state = setup(source)
  for await (const batch of state.service.queryBatches('SELECT many')) {
    assert.deepEqual(batch, [{ id: 1 }])
    break
  }
  await nextTurn()
  assert.equal(state.closed, 1)
  assert.equal(source.destroyed, true)
  assert.equal(source.readableEnded, false)
})

test('调用方处理批次抛错时也取消未结束的查询流', async () => {
  let started = false
  const source = new Readable({
    read() {
      if (started) return
      started = true
      this.push(Buffer.from('{"id":1}\n'))
    },
  })
  const state = setup(source)
  const error = new Error('consumer failed')
  await assert.rejects(async () => {
    for await (const batch of state.service.queryBatches('SELECT many')) {
      assert.equal(batch.length, 1)
      throw error
    }
  }, actual => actual === error)
  await nextTurn()
  assert.equal(state.closed, 1)
  assert.equal(source.destroyed, true)
})

test('JSON 解析失败保持原错误并释放未结束响应', async () => {
  let started = false
  const source = new Readable({
    read() {
      if (started) return
      started = true
      this.push(Buffer.from('{bad-json}\n'))
    },
  })
  const state = setup(source)
  await assert.rejects(async () => {
    for await (const batch of state.service.queryBatches('SELECT malformed')) assert.fail(`unexpected batch: ${batch}`)
  }, SyntaxError)
  await nextTurn()
  assert.equal(state.closed, 1)
  assert.equal(source.destroyed, true)
})

test('底层响应流失败保持原错误并关闭结果', async () => {
  const error = new Error('response interrupted')
  const source = new Readable({ read() { this.destroy(error) } })
  const state = setup(source)
  await assert.rejects(async () => {
    for await (const batch of state.service.queryBatches('SELECT interrupted')) assert.fail(`unexpected batch: ${batch}`)
  }, actual => actual === error)
  await nextTurn()
  assert.equal(state.closed, 1)
  assert.equal(source.destroyed, true)
})

test('创建结果流时同步抛错仍关闭已经建立的结果', async () => {
  const error = new Error('stream initialization failed')
  let closed = 0
  const service = new ClickHouseService({ query: async () => ({
    stream() { throw error },
    close() { closed++ },
  }) })
  await assert.rejects(async () => {
    for await (const batch of service.queryBatches('SELECT invalid stream')) assert.fail(`unexpected batch: ${batch}`)
  }, actual => actual === error)
  assert.equal(closed, 1)
})

test('建立查询失败原样向调用方传播，不尝试消费未建立的结果', async () => {
  const error = new Error('query rejected')
  let queried = 0
  const service = new ClickHouseService({ query: async () => { queried++; throw error } })
  const batches = service.queryBatches('SELECT unavailable')
  assert.equal(queried, 0, 'async generator 在开始迭代前不建立查询')
  await assert.rejects(batches.next(), actual => actual === error)
  assert.equal(queried, 1)
  assert.deepEqual(await batches.next(), { done: true, value: undefined })
})
