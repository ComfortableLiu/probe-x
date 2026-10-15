require('reflect-metadata')
const assert = require('node:assert/strict')
const { test } = require('node:test')
const { EventEmitter } = require('node:events')
require('ts-node').register({
  transpileOnly: true,
  skipProject: true,
  compilerOptions: { target: 'ES2022', module: 'CommonJS', moduleResolution: 'node', experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true },
})
const { metricsWindow, metricsKey, recordRuntimeMetric, recordCleaningOutcome, recordCleaningSessionCompletion, recordNodeCleaningSpeed, readNodeCleaningSpeeds, nodeCleaningMetricsKey, METRICS_TTL_SECONDS } = require('../libs/shared-utils/src/lib/backend-common/runtime-metrics.ts')
const { RuntimeMetricsService } = require('../apps/data-dashboard-api-service/src/api/system-data/runtime-metrics.service.ts')
const { RuntimeMetricsMiddleware } = require('../apps/data-dashboard-api-service/src/api/system-data/runtime-metrics.middleware.ts')
const { OverviewService } = require('../apps/data-dashboard-api-service/src/api/system-data/overview.service.ts')

class MemoryRedis {
  status = 'ready'
  data = new Map()
  expiry = new Map()
  evalCalls = 0
  async eval(script, numberOfKeys, key, eventsRaw, durationRaw, ttlRaw) {
    assert.equal(numberOfKeys, 1)
    assert.match(script, /redis\.call\('HINCRBY', KEYS\[1\], 'samples', 1\)/)
    assert.match(script, /redis\.call\('HINCRBYFLOAT', KEYS\[1\], 'events', ARGV\[1\]\)/)
    assert.match(script, /redis\.call\('EXPIRE', KEYS\[1\], ARGV\[3\]\)/)
    this.evalCalls++
    // Redis executes the complete Lua script atomically, including both extrema.
    const row = this.data.get(key) || {}
    const events = Number(eventsRaw)
    const durationMs = Number(durationRaw)
    const speed = events * 1000 / durationMs
    row.samples = String(Number(row.samples || 0) + 1)
    row.events = String(Number(row.events || 0) + events)
    row.durationMs = String(Number(row.durationMs || 0) + durationMs)
    if (row.maxSpeed === undefined || speed > Number(row.maxSpeed)) row.maxSpeed = String(speed)
    if (row.minSpeed === undefined || speed < Number(row.minSpeed)) row.minSpeed = String(speed)
    this.data.set(key, row)
    this.expiry.set(key, Number(ttlRaw))
    return 1
  }
  async hset(key, field, value) {
    const row = this.data.get(key) || {}
    row[field] = String(value)
    this.data.set(key, row)
    return 1
  }
  multi() {
    const operations = []
    const tx = {}
    for (const command of ['hsetnx', 'hincrby', 'hincrbyfloat', 'expire', 'hgetall', 'hmget', 'hget', 'hset']) {
      tx[command] = (key, field, value) => {
        operations.push(() => {
          const row = this.data.get(key) || {}
          if (command === 'hgetall') return { ...row }
          if (command === 'hmget') return [row[field] ?? null, row[value] ?? null]
          if (command === 'hget') return row[field] ?? null
          if (command === 'expire') return 1
          if (command === 'hset') { row[field] = String(value) }
          else if (command === 'hsetnx') { if (!(field in row)) row[field] = String(value) }
          else row[field] = String(Number(row[field] || 0) + value)
          this.data.set(key, row)
          return 1
        })
        return tx
      }
    }
    tx.exec = async () => operations.map(op => [null, op()])
    return tx
  }
}
const at = value => Date.parse(`${value}+08:00`)
const metricsFixture = () => {
  const redis = new MemoryRedis()
  return { redis, service: new RuntimeMetricsService({ getClient: () => redis }) }
}

test('calendar windows use Shanghai Monday/month boundaries including cross-month weeks', () => {
  const window = metricsWindow(at('2026-03-01T00:00:00'))
  assert.equal(window.today, '2026-03-01')
  assert.equal(window.yesterday, '2026-02-28')
  assert.equal(window.weekStart, '2026-02-23')
  assert.equal(window.monthStart, '2026-03-01')
  assert.deepEqual(window.monthDays, ['2026-03-01'])
})

test('missing samples stay null; real zero throughput is retained after a complete observed minute', async () => {
  const { redis, service } = metricsFixture()
  assert.equal((await service.getPerformance(at('2026-09-29T10:01:00'))).currentQps, null)
  await recordRuntimeMetric(redis, 'processing', 0, undefined, at('2026-09-29T10:00:00'))
  const processing = await service.getProcessing(at('2026-09-29T10:01:00'))
  assert.equal(processing.currentProcessing, 0)
  assert.equal(processing.peakProcessing, 0)
  assert.equal(processing.finalCleaningSuccessRate, null)
})

test('API counters include distinct client/server/business failures and persisted monthly samples', async () => {
  const { redis, service } = metricsFixture()
  const start = at('2026-09-29T10:00:00')
  for (const [duration, status, businessError] of [[10, 200, false], [20, 400, false], [40, 500, true], [50, 200, true]]) {
    await recordRuntimeMetric(redis, 'api', 1, { duration, status, businessError }, start)
  }
  const freshService = new RuntimeMetricsService({ getClient: () => redis })
  const result = await freshService.getPerformance(start + 60000)
  assert.equal(result.currentQps, 4 / 60)
  assert.equal(result.peakQps, 4 / 60)
  assert.equal(result.avgResponseTime, 30)
  assert.equal(result.p95ResponseTime, 50)
  assert.equal(result.requestErrorRate, 25)
  assert.equal(result.systemErrorRate, 25)
  assert.equal(result.businessErrorRate, 25)
  assert.equal(result.systemAvailability, 25)
  assert.equal(result.currentMonthAvailability, 25)
  assert.equal((await service.getPerformance(start + 120000)).currentQps, 0)
})

test('midnight throughput reads previous day while monthly success resets', async () => {
  const { redis, service } = metricsFixture()
  await recordRuntimeMetric(redis, 'api', 1, { duration: 5, status: 200, businessError: false }, at('2026-09-30T23:59:00'))
  const result = await service.getPerformance(at('2026-10-01T00:00:10'))
  assert.equal(result.currentQps, 1 / 60)
  assert.equal(result.systemAvailability, 100)
  assert.equal(result.currentMonthAvailability, null)
})

test('first partial minute and histogram overflow do not fabricate valid measurements', async () => {
  const { redis, service } = metricsFixture()
  const start = at('2026-09-29T10:00:30')
  await recordRuntimeMetric(redis, 'api', 1, { duration: 61000, status: 200, businessError: false }, start)
  const result = await service.getPerformance(start + 30000)
  assert.equal(result.currentQps, null)
  assert.equal(result.peakQps, null)
  assert.equal(result.p99ResponseTime, null)
})

test('processing counts completed writes and independently measures actual task outcomes', async () => {
  const { redis, service } = metricsFixture()
  const start = at('2026-09-29T10:00:00')
  await recordRuntimeMetric(redis, 'processing', 300, undefined, start)
  await recordRuntimeMetric(redis, 'processing', 100, undefined, start)
  await recordCleaningOutcome(redis, true, start)
  await recordCleaningOutcome(redis, false, start)
  const result = await service.getProcessing(start + 60000)
  assert.deepEqual(result, {
    firstCleaningSuccessRate: null,
    currentProcessing: 400,
    peakProcessing: 400,
    finalCleaningSuccessRate: 50,
    currentCleaningSpeed: 400 / 60,
    peakCleaningSpeed: 400 / 60,
    currentSessionSpeed: 0,
    peakSessionSpeed: 0,
  })
  redis.status = 'reconnecting'
  await assert.rejects(recordRuntimeMetric(redis, 'processing', 1), /未就绪/)
  await assert.rejects(service.getProcessing(start), /未就绪/)
})

test('session speed comes from master-observed completion buckets in complete minutes', async () => {
  const { redis, service } = metricsFixture()
  const start = at('2026-09-29T10:00:00')
  await recordRuntimeMetric(redis, 'processing', 600, undefined, start)
  await recordCleaningSessionCompletion(redis, start)
  await recordCleaningSessionCompletion(redis, start)
  await recordCleaningSessionCompletion(redis, start)
  const result = await service.getProcessing(start + 60000)
  assert.equal(result.currentCleaningSpeed, 10)
  assert.equal(result.peakCleaningSpeed, 10)
  assert.equal(result.currentSessionSpeed, 3 / 60)
  assert.equal(result.peakSessionSpeed, 3 / 60)
  // 首个不完整分钟不展示速度
  const partial = await service.getProcessing(start + 30000)
  assert.equal(partial.currentSessionSpeed, null)
  assert.equal(partial.peakSessionSpeed, null)
})

test('node cleaning speeds count all concurrent events against one busy wall-clock interval', async () => {
  const redis = new MemoryRedis()
  const now = at('2026-09-29T10:00:00')
  // Fourteen workers process 100 events each during the same one-second interval.
  await recordNodeCleaningSpeed(redis, 'node-1', 14 * 100, 1000, now)
  const stats = await readNodeCleaningSpeeds(redis, ['node-1', 'node-2'], now)
  assert.deepEqual(stats.get('node-1'), { avg: 1400, max: 1400, min: 1400 })
  assert.deepEqual(stats.get('node-2'), { avg: null, max: null, min: null })
  const key = nodeCleaningMetricsKey('node-1', '2026-09-29')
  assert.deepEqual(redis.data.get(key), { samples: '1', events: '1400', durationMs: '1000', maxSpeed: '1400', minSpeed: '1400' })
  assert.equal(redis.expiry.get(key), METRICS_TTL_SECONDS)
})

test('node speed average is weighted by busy wall-clock time and retains zero-progress intervals', async () => {
  const redis = new MemoryRedis()
  const now = at('2026-09-29T10:00:00')
  await recordNodeCleaningSpeed(redis, 'node-1', 1400, 1000, now)
  await recordNodeCleaningSpeed(redis, 'node-1', 600, 3000, now)
  let stats = await readNodeCleaningSpeeds(redis, ['node-1'], now)
  assert.deepEqual(stats.get('node-1'), { avg: 500, max: 1400, min: 200 })
  await recordNodeCleaningSpeed(redis, 'node-1', 0, 1000, now)
  stats = await readNodeCleaningSpeeds(redis, ['node-1'], now)
  assert.deepEqual(stats.get('node-1'), { avg: 400, max: 1400, min: 0 })
  await recordNodeCleaningSpeed(redis, 'stalled-node', 0, 1000, now)
  assert.deepEqual((await readNodeCleaningSpeeds(redis, ['stalled-node'], now)).get('stalled-node'), { avg: 0, max: 0, min: 0 })
})

test('invalid node speed samples do not create hashes or contribute durations', async () => {
  const redis = new MemoryRedis()
  const now = at('2026-09-29T10:00:00')
  for (const events of [-1, NaN, Infinity, -Infinity]) {
    await recordNodeCleaningSpeed(redis, 'node-1', events, 1000, now)
  }
  for (const duration of [0, -1, NaN, Infinity, -Infinity]) {
    await recordNodeCleaningSpeed(redis, 'node-1', 100, duration, now)
  }
  assert.equal(redis.evalCalls, 0)
  assert.equal(redis.data.size, 0)
  assert.deepEqual((await readNodeCleaningSpeeds(redis, ['node-1'], now)).get('node-1'), { avg: null, max: null, min: null })
})

test('v2 node totals never mix with or delete legacy per-task speed hashes', async () => {
  const redis = new MemoryRedis()
  const now = at('2026-09-29T10:00:00')
  const oldKey = 'probe-x:overview:v1:nodeCleaning:2026-09-29:node-1'
  const oldRow = { tasks: '14', events: '1400', durationMs: '14000', maxSpeed: '100', minSpeed: '100' }
  redis.data.set(oldKey, { ...oldRow })
  assert.deepEqual((await readNodeCleaningSpeeds(redis, ['node-1'], now)).get('node-1'), { avg: null, max: null, min: null })
  await recordNodeCleaningSpeed(redis, 'node-1', 1400, 1000, now)
  assert.equal(nodeCleaningMetricsKey('node-1', '2026-09-29'), 'probe-x:overview:v2:nodeCleaning:2026-09-29:node-1')
  assert.deepEqual((await readNodeCleaningSpeeds(redis, ['node-1'], now)).get('node-1'), { avg: 1400, max: 1400, min: 1400 })
  assert.deepEqual(redis.data.get(oldKey), oldRow)
})

test('atomic node interval writes preserve counters and extrema across concurrent callers', async () => {
  const redis = new MemoryRedis()
  const now = at('2026-09-29T10:00:00')
  // Arrival order may overlap even though the sampled busy intervals are disjoint.
  await Promise.all([[200, 1000], [100, 1000], [600, 2000]].map(([events, duration]) =>
    recordNodeCleaningSpeed(redis, 'node-1', events, duration, now)))
  assert.deepEqual((await readNodeCleaningSpeeds(redis, ['node-1'], now)).get('node-1'), { avg: 225, max: 300, min: 100 })
  const key = nodeCleaningMetricsKey('node-1', '2026-09-29')
  assert.equal(redis.data.get(key).samples, '3')
  assert.equal(redis.evalCalls, 3)
  assert.equal(redis.expiry.get(key), METRICS_TTL_SECONDS)
})

test('node total speed statistics are isolated by node and Shanghai calendar day', async () => {
  const redis = new MemoryRedis()
  const beforeMidnight = at('2026-09-29T23:59:59')
  const afterMidnight = at('2026-09-30T00:00:00')
  // The caller splits intervals at midnight and assigns each part to its own day.
  await recordNodeCleaningSpeed(redis, 'node-1', 100, 1000, beforeMidnight)
  await recordNodeCleaningSpeed(redis, 'node-1', 300, 1000, afterMidnight)
  await recordNodeCleaningSpeed(redis, 'node-2', 800, 1000, afterMidnight)
  assert.deepEqual((await readNodeCleaningSpeeds(redis, ['node-1', 'node-2'], beforeMidnight)).get('node-1'), { avg: 100, max: 100, min: 100 })
  const stats = await readNodeCleaningSpeeds(redis, ['node-1', 'node-2'], afterMidnight)
  assert.deepEqual(stats.get('node-1'), { avg: 300, max: 300, min: 300 })
  assert.deepEqual(stats.get('node-2'), { avg: 800, max: 800, min: 800 })
  assert.deepEqual(await readNodeCleaningSpeeds(redis, [], afterMidnight), new Map())
})

test('node speed write and read failures remain observable to telemetry callers', async () => {
  const redis = new MemoryRedis()
  redis.status = 'reconnecting'
  await assert.rejects(recordNodeCleaningSpeed(redis, 'node-1', 100, 1000), /未就绪/)
  await assert.rejects(readNodeCleaningSpeeds(redis, ['node-1']), /未就绪/)
  redis.status = 'ready'
  redis.eval = async () => { throw new Error('Redis eval unavailable') }
  await assert.rejects(recordNodeCleaningSpeed(redis, 'node-1', 100, 1000), /Redis eval unavailable/)
  redis.eval = async () => null
  await assert.rejects(recordNodeCleaningSpeed(redis, 'node-1', 100, 1000), /节点清洗速度写入失败/)
})

test('HTTP middleware observes guard errors and business errors while excluding monitoring polls', () => {
  const samples = []
  const middleware = new RuntimeMetricsMiddleware({ record: (...args) => samples.push(args) })
  const response = () => Object.assign(new EventEmitter(), { statusCode: 200, json(body) { this.body = body; return this } })
  const res = response()
  middleware.use({ originalUrl: '/api/user/login' }, res, () => {})
  res.json({ code: -1 })
  res.emit('finish')
  res.emit('finish')
  assert.equal(samples.length, 1)
  assert.equal(samples[0][2], true)
  const denied = response()
  middleware.use({ originalUrl: '/api/project' }, denied, () => {})
  denied.statusCode = 403
  denied.emit('finish')
  assert.equal(samples[1][1], 403)
  const poll = response()
  middleware.use({ originalUrl: '/api/system-data/overview' }, poll, () => {})
  poll.emit('finish')
  assert.equal(samples.length, 2)
})

function overviewFixture({ failEvents = false, failNodes = false, nodes = [] } = {}) {
  let clickhouseCalls = 0
  const clickhouse = { query: async sql => {
    clickhouseCalls++
    if (sql.includes('FROM final_event_log')) return [{ count: '8' }]
    if (failEvents) throw new Error('ClickHouse down')
    return [{ todayCollection: '12', yesterdayCollection: '15', weekCollection: '27', monthCollection: '80', totalAmount: '100' }]
  } }
  const query = { select() { return this }, addSelect() { return this }, where() { return this }, getRawOne: async () => ({ todayQueries: '2', yesterdayQueries: '3', weekQueries: '5', monthQueries: '9' }) }
  const runtime = { getPerformance: async () => ({}), getProcessing: async () => ({ currentProcessing: 0, peakProcessing: 7, finalCleaningSuccessRate: 0, currentCleaningSpeed: 1.5, peakCleaningSpeed: 2.5, currentSessionSpeed: 0.5, peakSessionSpeed: 1 }) }
  const service = new OverviewService(clickhouse, { getTopology: async () => { if (failNodes) throw new Error('MySQL down'); return { nodes } } }, runtime, { createQueryBuilder: () => query }, { getResources: async () => [] })
  return { service, calls: () => clickhouseCalls }
}

test('overview separates query counts, preserves zeros, caches and coalesces concurrent reads', async () => {
  const { service, calls } = overviewFixture()
  const [a, b] = await Promise.all([service.getSystemDataOverview(), service.getSystemDataOverview()])
  assert.equal(a, b)
  assert.equal(a.eventCollectionMetrics.todayCollection, 12)
  assert.equal(a.analysisQueryMetrics.todayQueries, 2)
  assert.equal(a.metaOverview.finalCleaningSuccessRate, 0)
  assert.equal(a.realTimeProcessingMetrics.currentProcessing, 0)
  assert.equal(a.realTimeProcessingMetrics.cumulativeProcessing, 8)
  assert.equal(a.realTimeProcessingMetrics.currentCleaningSpeed, 1.5)
  assert.equal(a.realTimeProcessingMetrics.peakSessionSpeed, 1)
  assert.equal(a.computingNodeStatus.totalNodes, 0)
  assert.equal(a.computingNodeStatus.cpuUsage, null)
  await service.getSystemDataOverview()
  assert.equal(calls(), 2)
})

test('a failed data source leaves affected metrics unavailable while other sections still work', async () => {
  const { service } = overviewFixture({ failEvents: true, failNodes: true })
  const data = await service.getSystemDataOverview()
  assert.equal(data.eventCollectionMetrics.todayCollection, null)
  assert.equal(data.metaOverview.originalDataTotal, '—')
  assert.equal(data.metaOverview.finalCleanedData, '8')
  assert.equal(data.analysisQueryMetrics.todayQueries, 2)
  assert.equal(data.computingNodeStatus.totalNodes, null)
  assert.equal(data.warnings.length, 2)
})

test('only live nodes contribute resources, CPU and memory are weighted, partial telemetry is unavailable', async () => {
  const nodes = [
    { link: 'connected', cpuCount: 2, cpuUsage: 10, memorySize: 100, availableMemorySize: 50, loadAverage: 1, networkBytesPerSecond: 100 },
    { link: 'connected', cpuCount: 6, cpuUsage: 50, memorySize: 300, availableMemorySize: 50, loadAverage: 3, networkBytesPerSecond: 200 },
    { link: 'disconnected', cpuCount: 100, cpuUsage: 100, memorySize: 99999 },
  ]
  const data = await overviewFixture({ nodes }).service.getSystemDataOverview()
  assert.equal(data.computingNodeStatus.cpuUsage, 40)
  assert.equal(data.computingNodeStatus.memoryUsage, 75)
  assert.equal(data.computingNodeStatus.avgLoad, 2)
  assert.equal(data.computingNodeStatus.onlineNodes, 2)
  delete nodes[1].cpuUsage
  assert.equal((await overviewFixture({ nodes }).service.getSystemDataOverview()).computingNodeStatus.cpuUsage, null)
})

const { Subject } = require('rxjs')
const { ComputeNodeService } = require('../apps/final-data-cleaning-service/src/service/node.service.ts')
const { createPageViewEvent } = require('../apps/final-data-cleaning-service/src/__tests__/fixtures/event-factory.ts')
const drain = () => new Promise(resolve => setImmediate(resolve))

test('real cleaning service samples only successful inserts and does not count deduplicated replays', async () => {
  const redis = new MemoryRedis()
  let first = true
  const connection = { getClient: () => redis, setNx: async () => { const result = first; first = false; return result } }
  const service = new ComputeNodeService({ query: async () => [], insert: async () => {} }, connection)
  const progress = new Subject()
  const messages = []
  progress.subscribe(item => messages.push(item))
  const task = { task_id: 'test-task', date: '2026-09-29', session_id: 'test-session' }
  await service.executeTask(task, progress)
  await drain()
  assert.equal(messages.at(-1).completed, true)
  const key = metricsKey('processing', metricsWindow().today)
  assert.equal(redis.data.get(key).successfulTasks, '1')
  await service.executeTask(task, progress)
  await drain()
  assert.equal(redis.data.get(key).successfulTasks, '1')
})

test('failed cleaning insert reports failure without inventing processed events', async () => {
  const redis = new MemoryRedis()
  // 事件查询返回一条事件让落库真实发生（已落库 id 查询返回空），insert 抛错进入失败路径
  const query = async sql => sql.includes('FROM event_log') ? [createPageViewEvent('page-1')] : []
  const service = new ComputeNodeService({ query, insert: async () => { throw new Error('write failed') } }, { getClient: () => redis, setNx: async () => true })
  const progress = new Subject()
  const messages = []
  progress.subscribe(item => messages.push(item))
  await service.executeTask({ task_id: 'failed-task', date: '2026-09-29', session_id: 'test-session' }, progress)
  await drain()
  const row = redis.data.get(metricsKey('processing', metricsWindow().today))
  assert.equal(row.failedTasks, '1')
  assert.equal(row.count, undefined)
  assert.equal(messages.at(-1).failed, true)
})

test('telemetry outages cannot change successful task outcomes', async () => {
  const service = new ComputeNodeService({ query: async () => [], insert: async () => {} }, { getClient: () => { throw new Error('telemetry unavailable') }, setNx: async () => true })
  const progress = new Subject()
  const messages = []
  progress.subscribe(item => messages.push(item))
  await service.executeTask({ task_id: 'success-task', date: '2026-09-29', session_id: 'test-session' }, progress)
  await drain()
  assert.equal(messages.at(-1).completed, true)
  assert.equal(messages.at(-1).failed, false)
})

const { DataAnalysisRecordService } = require('../apps/data-dashboard-api-service/src/api/data-analysis/record.service.ts')
test('analysis records use the Shanghai calendar date even on UTC hosts', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-09-28T17:00:00Z') })
  let saved
  const service = new DataAnalysisRecordService({}, { save: async row => { saved = row } }, {}, {})
  await service.recordQuery({ userId: 1, username: 'test' }, '{}', 5, 0, true)
  const date = saved.queryDate
  const localDay = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  assert.equal(localDay, metricsWindow().today)
})
