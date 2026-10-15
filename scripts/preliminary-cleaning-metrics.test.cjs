require('reflect-metadata')
const assert = require('node:assert/strict')
const { test } = require('node:test')
const { setImmediate: nextTurn } = require('node:timers/promises')
require('ts-node').register({
  transpileOnly: true,
  skipProject: true,
  compilerOptions: { target: 'ES2022', module: 'CommonJS', moduleResolution: 'node', experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true },
})
const { KafkaConsumerService } = require('../apps/preliminary-data-processing-service/src/module/kafka-consumer/kafka-consumer.service.ts')
const {
  metricsKey, metricsWindow, METRICS_TTL_SECONDS,
  recordPreliminaryCleaningOutcome, recordCleaningOutcome, readCleaningOutcomes,
} = require('../libs/shared-utils/src/lib/backend-common/runtime-metrics.ts')

class MemoryRedis {
  status = 'ready'
  rows = new Map()
  expiries = new Map()
  error = null
  execCalls = 0
  multi() {
    const operations = []
    const tx = {}
    tx.hincrby = (key, field, count) => {
      operations.push(() => {
        const row = this.rows.get(key) || {}
        row[field] = String(Number(row[field] || 0) + count)
        this.rows.set(key, row)
        return Number(row[field])
      })
      return tx
    }
    tx.expire = (key, ttl) => {
      operations.push(() => { this.expiries.set(key, ttl); return 1 })
      return tx
    }
    tx.hmget = (key, ...fields) => {
      operations.push(() => fields.map(field => this.rows.get(key)?.[field] ?? null))
      return tx
    }
    tx.exec = async () => {
      this.execCalls++
      if (this.error) throw this.error
      return operations.map(op => [null, op()])
    }
    return tx
  }
}

const empty = () => ({ successRate: null, successCount: null, failCount: null })
const event = id => ({ $event_id: id, $device_id: 'device', $event_name: 'page_view', $log_time: 1 })
const meta = offset => ({ topic: 'events', partition: 0, offset })
const at = value => Date.parse(`${value}+08:00`)
function deferred() {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}
function fixture() {
  const metrics = new MemoryRedis()
  const keys = new Set()
  const commits = []
  const inserts = []
  const clickhouse = { insert: async (table, rows) => { inserts.push({ table, rows }) } }
  const redis = {
    getClient: () => metrics,
    setNx: async key => { if (keys.has(key)) return false; keys.add(key); return true },
    del: async key => keys.delete(key),
  }
  const service = new KafkaConsumerService(clickhouse, redis, {})
  service.completeSpmAndScm = async () => ({})
  service.splitSessionAndUtm = async () => ({ sessionId: 'session', utmInfo: {} })
  const consume = (id, offset) => service.handleEvent(event(id), meta(offset), async rows => { commits.push(...rows) })
  return { metrics, keys, commits, inserts, clickhouse, redis, service, consume }
}
const outcomes = metrics => readCleaningOutcomes(metrics)

test('preliminary outcomes have independent keys, Shanghai dates and 35-day TTL; nonpositive counts are ignored', async () => {
  const redis = new MemoryRedis()
  const now = at('2026-10-15T00:00:00')
  await recordPreliminaryCleaningOutcome(redis, true, 3, now)
  await recordPreliminaryCleaningOutcome(redis, false, 2, now)
  assert.deepEqual(redis.rows.get(metricsKey('preliminary', '2026-10-15')), { successfulEvents: '3', failedEvents: '2' })
  assert.equal(redis.expiries.get(metricsKey('preliminary', '2026-10-15')), METRICS_TTL_SECONDS)
  assert.equal(redis.rows.has(metricsKey('processing', '2026-10-15')), false)
  redis.status = 'reconnecting'
  await recordPreliminaryCleaningOutcome(redis, true, 0, now)
  await recordPreliminaryCleaningOutcome(redis, true, -1, now)
  assert.equal(redis.execCalls, 2)
  await assert.rejects(recordPreliminaryCleaningOutcome(redis, true, 1, now), /未就绪/)
})

test('buffering and pending ClickHouse insert do not count success or commit offsets', async () => {
  const f = fixture()
  const gate = deferred()
  await f.consume('a', 0)
  await nextTurn()
  assert.deepEqual((await outcomes(f.metrics)).firstCleaning, empty())
  assert.deepEqual(f.commits, [])
  f.clickhouse.insert = () => gate.promise
  const flush = f.service.flushEventLog()
  await nextTurn()
  assert.deepEqual((await outcomes(f.metrics)).firstCleaning, empty())
  assert.deepEqual(f.commits, [])
  gate.resolve()
  await flush
  await nextTurn()
  assert.deepEqual((await outcomes(f.metrics)).firstCleaning, { successRate: 100, successCount: 1, failCount: 0 })
  assert.equal(f.commits[0].offset, '1')
})

test('failed writes restore the batch and dedup keys; successful retry and replay count only actual attempts', async () => {
  const f = fixture()
  await f.consume('a', 0)
  const failure = new Error('ECONNRESET')
  f.clickhouse.insert = async () => { throw failure }
  await assert.rejects(f.service.flushEventLog(), error => error === failure)
  await nextTurn()
  assert.equal(f.service.eventBuffer.length, 1)
  assert.equal(f.keys.size, 0)
  assert.deepEqual(f.commits, [])
  assert.deepEqual((await outcomes(f.metrics)).firstCleaning, { successRate: 0, successCount: 0, failCount: 1 })
  f.clickhouse.insert = async () => undefined
  await f.service.flushEventLog()
  await nextTurn()
  assert.deepEqual((await outcomes(f.metrics)).firstCleaning, { successRate: 50, successCount: 1, failCount: 1 })
  await f.consume('a', 1)
  await f.service.flushEventLog()
  await nextTurn()
  assert.deepEqual((await outcomes(f.metrics)).firstCleaning, { successRate: 50, successCount: 1, failCount: 1 })
  assert.equal(f.commits.at(-1).offset, '2')
})

test('already deduplicated events contribute neither batch success nor failure', async () => {
  const f = fixture()
  f.keys.add('dedup:event:duplicate')
  await f.consume('duplicate', 0)
  await f.consume('new', 1)
  f.clickhouse.insert = async () => { throw new Error('timeout') }
  await assert.rejects(f.service.flushEventLog(), /timeout/)
  await nextTurn()
  assert.deepEqual((await outcomes(f.metrics)).firstCleaning, { successRate: 0, successCount: 0, failCount: 1 })
  assert.deepEqual([...f.keys], ['dedup:event:duplicate'])
})

test('Redis dedup failure counts the pending batch once and preserves the original error and buffer', async () => {
  const f = fixture()
  await f.consume('a', 0)
  await f.consume('b', 1)
  const failure = new Error('Redis connection timeout')
  f.redis.setNx = async () => { throw failure }
  await assert.rejects(f.service.flushEventLog(), error => error === failure)
  await nextTurn()
  assert.equal(f.service.eventBuffer.length, 2)
  assert.equal(f.inserts.length, 0)
  assert.equal((await outcomes(f.metrics)).firstCleaning.failCount, 2)
})

test('conversion failures count one event while preserving retryable versus dirty-data offset behavior', async () => {
  const f = fixture()
  const connectionError = new Error('ECONNREFUSED')
  f.service.splitSessionAndUtm = async () => { throw connectionError }
  await assert.rejects(f.consume('retry', 0), error => error === connectionError)
  await nextTurn()
  assert.equal(f.commits.length, 0)
  assert.equal(f.inserts.length, 0)
  f.service.splitSessionAndUtm = async () => { throw new Error('bad event') }
  await f.consume('dirty', 1)
  await nextTurn()
  assert.equal(f.inserts[0].table, 'error_log')
  assert.equal(f.commits[0].offset, '2')
  assert.equal((await outcomes(f.metrics)).firstCleaning.failCount, 2)
})

test('threshold-triggered flush failure is counted by the batch, not again by handleEvent', async () => {
  const f = fixture()
  const originalThreshold = KafkaConsumerService.FLUSH_BATCH_SIZE
  KafkaConsumerService.FLUSH_BATCH_SIZE = 1
  try {
    f.clickhouse.insert = async () => { throw new Error('ClickHouse connection timeout') }
    await assert.rejects(f.consume('a', 0), /timeout/)
    await nextTurn()
    assert.equal((await outcomes(f.metrics)).firstCleaning.failCount, 1)
    assert.equal(f.service.eventBuffer.length, 1)
    assert.equal(f.commits.length, 0)
  } finally {
    KafkaConsumerService.FLUSH_BATCH_SIZE = originalThreshold
  }
})

test('telemetry failures never fail writes or commits, alter retries, or repeatedly warn', async () => {
  const f = fixture()
  const originalWarn = console.warn
  const warnings = []
  console.warn = (...args) => warnings.push(args)
  try {
    f.redis.getClient = () => { throw new Error('telemetry client failure') }
    await f.consume('a', 0)
    await f.service.flushEventLog()
    await nextTurn()
    assert.equal(f.commits[0].offset, '1')
    assert.equal(f.service.eventBuffer.length, 0)
    await f.consume('b', 1)
    const failure = new Error('ClickHouse timeout')
    f.clickhouse.insert = async () => { throw failure }
    await assert.rejects(f.service.flushEventLog(), error => error === failure)
    await nextTurn()
    assert.equal(f.service.eventBuffer.length, 1)
    assert.equal(f.commits.length, 1)
    assert.equal(warnings.length, 1)
  } finally {
    console.warn = originalWarn
  }
})

test('a pending telemetry request does not delay successful business completion', async () => {
  const f = fixture()
  const gate = deferred()
  f.metrics.multi = () => {
    const tx = { hincrby: () => tx, expire: () => tx, exec: () => gate.promise }
    return tx
  }
  await f.consume('a', 0)
  await f.service.flushEventLog()
  assert.equal(f.commits[0].offset, '1')
  gate.resolve([[null, 1], [null, 1]])
  await nextTurn()
})

test('asynchronously rejected telemetry does not change dirty-data handling or offset commits', async () => {
  const f = fixture()
  const warn = console.warn
  console.warn = () => undefined
  try {
    f.metrics.error = new Error('monitoring Redis failure')
    f.service.completeSpmAndScm = async () => { throw new Error('bad event') }
    await f.consume('dirty', 0)
    await nextTurn()
    assert.equal(f.inserts[0].table, 'error_log')
    assert.equal(f.commits[0].offset, '1')
    assert.equal(f.service.eventBuffer.length, 0)
  } finally {
    console.warn = warn
  }
})

test('outcome writer rejects missing and per-command failed transactions', async () => {
  const redis = new MemoryRedis()
  redis.multi = () => {
    const tx = { hincrby: () => tx, expire: () => tx, exec: async () => null }
    return tx
  }
  await assert.rejects(recordPreliminaryCleaningOutcome(redis, true), /结果写入失败/)
  redis.multi = () => {
    const tx = { hincrby: () => tx, expire: () => tx, exec: async () => [[new Error('ERR increment'), null]] }
    return tx
  }
  await assert.rejects(recordPreliminaryCleaningOutcome(redis, true), /结果写入失败/)
})

test('reader derives omitted dates and retention boundaries from the supplied observation time', async () => {
  const redis = new MemoryRedis()
  const now = at('2026-03-01T00:00:00')
  await recordPreliminaryCleaningOutcome(redis, true, 2, now)
  assert.equal((await readCleaningOutcomes(redis, undefined, undefined, now)).firstCleaning.successCount, 2)
  await recordCleaningOutcome(redis, true, at('2026-02-28T23:59:59'))
  assert.equal((await readCleaningOutcomes(redis, '2026-02-28', undefined, now)).finalCleaning.successCount, 1)
  assert.deepEqual(await readCleaningOutcomes(redis, '2026-01-25', '2026-03-01', now), { firstCleaning: empty(), finalCleaning: empty() })
})

test('outcome helper distinguishes no samples, 100%, 0%, mixed rates and independent stages', async () => {
  const redis = new MemoryRedis()
  assert.deepEqual(await readCleaningOutcomes(redis), { firstCleaning: empty(), finalCleaning: empty() })
  await recordPreliminaryCleaningOutcome(redis, true, 4)
  await recordCleaningOutcome(redis, false)
  assert.deepEqual(await readCleaningOutcomes(redis), {
    firstCleaning: { successRate: 100, successCount: 4, failCount: 0 },
    finalCleaning: { successRate: 0, successCount: 0, failCount: 1 },
  })
  await recordPreliminaryCleaningOutcome(redis, false, 1)
  await recordCleaningOutcome(redis, true)
  assert.deepEqual(await readCleaningOutcomes(redis), {
    firstCleaning: { successRate: 80, successCount: 4, failCount: 1 },
    finalCleaning: { successRate: 50, successCount: 1, failCount: 1 },
  })
})

test('date ranges sum true samples across Shanghai days and tolerate days with no samples', async () => {
  const redis = new MemoryRedis()
  const now = Date.now
  Date.now = () => at('2026-10-15T12:00:00')
  try {
    await recordPreliminaryCleaningOutcome(redis, true, 9, at('2026-10-13T23:59:59'))
    await recordPreliminaryCleaningOutcome(redis, false, 1, at('2026-10-15T00:00:00'))
    await recordCleaningOutcome(redis, true, at('2026-10-13T23:59:59'))
    await recordCleaningOutcome(redis, false, at('2026-10-15T00:00:00'))
    assert.deepEqual(await readCleaningOutcomes(redis, '2026-10-13', '2026-10-15'), {
      firstCleaning: { successRate: 90, successCount: 9, failCount: 1 },
      finalCleaning: { successRate: 50, successCount: 1, failCount: 1 },
    })
    assert.deepEqual(await readCleaningOutcomes(redis, '2026-10-14'), { firstCleaning: empty(), finalCleaning: empty() })
    assert.equal((await readCleaningOutcomes(redis, '2026-10-13')).firstCleaning.successCount, 9)
  } finally {
    Date.now = now
  }
})

test('expired, overlong and future ranges return no data for both stages without reading partial ranges', async () => {
  const redis = new MemoryRedis()
  const now = Date.now
  Date.now = () => at('2026-10-15T12:00:00')
  try {
    await recordPreliminaryCleaningOutcome(redis, true, 9, Date.now())
    await recordCleaningOutcome(redis, true, Date.now())
    for (const [start, end] of [
      ['2026-09-10', '2026-10-15'], ['2026-09-01', '2026-09-01'], ['2026-10-15', '2026-10-16'],
    ]) {
      const calls = redis.execCalls
      assert.deepEqual(await readCleaningOutcomes(redis, start, end), { firstCleaning: empty(), finalCleaning: empty() })
      assert.equal(redis.execCalls, calls)
    }
    assert.equal((await readCleaningOutcomes(redis, '2026-09-11', '2026-10-15')).firstCleaning.successCount, 9)
  } finally {
    Date.now = now
  }
})

test('date helper rejects invalid calendar dates, formats and reversed ranges', async () => {
  const redis = new MemoryRedis()
  for (const date of ['2026-02-30', '2026-13-01', '2026-1-01', 'not-a-date', '2026-10-15T00:00:00']) {
    await assert.rejects(readCleaningOutcomes(redis, date), /有效的 YYYY-MM-DD/)
  }
  await assert.rejects(readCleaningOutcomes(redis, '2026-10-15', '2026-10-14'), /晚于/)
})

test('Redis and malformed-counter failures propagate to the caller for graceful degradation', async () => {
  const redis = new MemoryRedis()
  redis.status = 'reconnecting'
  await assert.rejects(readCleaningOutcomes(redis), /未就绪/)
  redis.status = 'ready'
  redis.error = new Error('telemetry unavailable')
  await assert.rejects(readCleaningOutcomes(redis), /telemetry unavailable/)
  redis.error = null
  redis.rows.set(metricsKey('preliminary', metricsWindow().today), { successfulEvents: 'bad' })
  await assert.rejects(readCleaningOutcomes(redis), /计数无效/)
  redis.multi = () => ({ hmget() { return this }, exec: async () => [[new Error('Redis read error'), null]] })
  await assert.rejects(readCleaningOutcomes(redis), /读取失败/)
})
