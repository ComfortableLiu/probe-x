require('reflect-metadata')
const assert = require('node:assert/strict')
const { test } = require('node:test')
const { EventEmitter } = require('node:events')
require('ts-node').register({
  transpileOnly: true,
  skipProject: true,
  compilerOptions: { target: 'ES2022', module: 'CommonJS', moduleResolution: 'node', experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true },
})
const { metricsWindow, metricsKey, recordRuntimeMetric, recordCleaningOutcome } = require('../libs/shared-utils/src/lib/backend-common/runtime-metrics.ts')
const { RuntimeMetricsService } = require('../apps/data-dashboard-api-service/src/api/system-data/runtime-metrics.service.ts')
const { RuntimeMetricsMiddleware } = require('../apps/data-dashboard-api-service/src/api/system-data/runtime-metrics.middleware.ts')
const { OverviewService } = require('../apps/data-dashboard-api-service/src/api/system-data/overview.service.ts')

class MemoryRedis {
  status = 'ready'
  data = new Map()
  multi() {
    const operations = []
    const tx = {}
    for (const command of ['hsetnx', 'hincrby', 'hincrbyfloat', 'expire', 'hgetall', 'hmget']) {
      tx[command] = (key, field, value) => {
        operations.push(() => {
          const row = this.data.get(key) || {}
          if (command === 'hgetall') return { ...row }
          if (command === 'hmget') return [row[field] ?? null, row[value] ?? null]
          if (command === 'expire') return 1
          if (command === 'hsetnx') { if (!(field in row)) row[field] = String(value) }
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
  assert.deepEqual(result, { currentProcessing: 400, peakProcessing: 400, finalCleaningSuccessRate: 50 })
  redis.status = 'reconnecting'
  await assert.rejects(recordRuntimeMetric(redis, 'processing', 1), /未就绪/)
  await assert.rejects(service.getProcessing(start), /未就绪/)
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
  const runtime = { getPerformance: async () => ({}), getProcessing: async () => ({ currentProcessing: 0, peakProcessing: 7, finalCleaningSuccessRate: 0 }) }
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
  const service = new ComputeNodeService({ query: async () => [], insert: async () => { throw new Error('write failed') } }, { getClient: () => redis, setNx: async () => true })
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
