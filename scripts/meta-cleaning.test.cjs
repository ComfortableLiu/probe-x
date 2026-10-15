require('reflect-metadata')
const assert = require('node:assert/strict')
const { test } = require('node:test')
require('ts-node').register({ transpileOnly: true, skipProject: true, compilerOptions: {
  target: 'ES2022', module: 'CommonJS', moduleResolution: 'node', experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true,
} })
const { MetaService } = require('../apps/data-dashboard-api-service/src/api/system-data/meta.service.ts')
const empty = () => ({ successRate: null, successCount: null, failCount: null })
const outcomes = () => ({ firstCleaning: empty(), finalCleaning: empty() })
function fixture(data = outcomes(), fail = false) {
  const queries = []
  const reads = []
  const service = new MetaService({ query: async (sql, params) => {
    queries.push({ sql, params })
    return [{ count: sql.includes('FROM final_event_log') ? '100' : '2500' }]
  } }, { getCleaningOutcomes: async (...period) => {
    reads.push(period)
    if (fail) throw new Error('Redis unavailable')
    return data
  } })
  return { service, queries, reads }
}

test('缺少执行结果不以表存量伪造成功率或失败数', async () => {
  const { service, queries } = fixture()
  assert.deepEqual(await service.getMetaOverview(), {
    originalDataTotal: '2.5k', finalCleanedData: '100', firstCleaningSuccessRate: null, finalCleaningSuccessRate: null,
  })
  const missing = { successRate: null, successCount: '—', failCount: '—' }
  assert.deepEqual(await service.getCleaningStats(), { firstCleaning: missing, finalCleaning: missing })
  assert.deepEqual(await service.getFirstCleaningDetail(), { ...missing, detailList: [] })
  assert.deepEqual(await service.getFinalCleaningDetail(), { ...missing, detailList: [] })
  assert.equal(queries.length, 2, '仅库存概览查询事件表，执行结果数量不来自库存')
})

test('概览、统计、详情共用真实事件和任务尝试结果及一致快照', async () => {
  const { service, reads } = fixture({
    firstCleaning: { successRate: 75, successCount: 3, failCount: 1 },
    finalCleaning: { successRate: 100, successCount: 2845, failCount: 0 },
  })
  const [overview, stats, first, final] = await Promise.all([
    service.getMetaOverview(), service.getCleaningStats(), service.getFirstCleaningDetail(), service.getFinalCleaningDetail(),
  ])
  assert.equal(overview.firstCleaningSuccessRate, 75)
  assert.equal(overview.finalCleaningSuccessRate, 100)
  assert.deepEqual(stats.firstCleaning, { successRate: 75, successCount: '3', failCount: '1' })
  assert.deepEqual(stats.finalCleaning, { successRate: 100, successCount: '2.8k', failCount: '0' })
  assert.deepEqual(first, { ...stats.firstCleaning, detailList: [] })
  assert.deepEqual(final, { ...stats.finalCleaning, detailList: [] })
  assert.equal(reads.length, 1)
})

test('真实全失败保留0%，无样本阶段仍为null', async () => {
  const { service } = fixture({ firstCleaning: { successRate: 0, successCount: 0, failCount: 5 }, finalCleaning: empty() })
  const stats = await service.getCleaningStats()
  assert.deepEqual(stats.firstCleaning, { successRate: 0, successCount: '0', failCount: '5' })
  assert.deepEqual(stats.finalCleaning, { successRate: null, successCount: '—', failCount: '—' })
})

test('监控不可用只降级结果采样，库存仍可读且不反推失败数', async () => {
  const { service } = fixture(outcomes(), true)
  const overview = await service.getMetaOverview()
  assert.equal(overview.originalDataTotal, '2.5k')
  assert.equal(overview.finalCleanedData, '100')
  assert.equal(overview.finalCleaningSuccessRate, null)
  assert.equal((await service.getFinalCleaningDetail()).failCount, '—')
})

test('日期范围完整用于库存和执行结果查询，旧date参数仍兼容', async () => {
  const { service, queries, reads } = fixture()
  await service.getMetaOverview(undefined, '2026-10-13', '2026-10-15')
  assert.deepEqual(reads[0], ['2026-10-13', '2026-10-15'])
  assert.ok(queries.every(({ sql, params }) => sql.includes('BETWEEN {startDate:Date} AND {endDate:Date}')
    && sql.includes("'Asia/Shanghai'") && params.startDate === '2026-10-13' && params.endDate === '2026-10-15'))
  await service.getCleaningStats('2026-10-14')
  assert.deepEqual(reads[1], ['2026-10-14', '2026-10-14'])
})

test('未指定日期时成功率使用上海今日，库存不限制日期', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-10-14T16:00:00Z') })
  const { service, queries, reads } = fixture()
  await service.getMetaOverview()
  assert.deepEqual(reads[0], ['2026-10-15', '2026-10-15'])
  assert.ok(queries.every(({ params }) => Object.keys(params).length === 0))
})

test('无效自然日、逆序及不完整范围不执行查询', async () => {
  const { service, queries, reads } = fixture()
  await assert.rejects(service.getMetaOverview('2026-02-30'), /YYYY-MM-DD/)
  await assert.rejects(service.getCleaningStats(undefined, '2026-10-15', '2026-10-14'), /开始日期/)
  await assert.rejects(service.getFirstCleaningDetail(undefined, '2026-10-14'), /一起提供/)
  assert.equal(queries.length, 0)
  assert.equal(reads.length, 0)
})

test('快照过期后重新读取执行结果', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-10-15T00:00:00Z') })
  const { service, reads } = fixture()
  await service.getCleaningStats()
  await service.getFinalCleaningDetail()
  assert.equal(reads.length, 1)
  t.mock.timers.tick(1001)
  await service.getFinalCleaningDetail()
  assert.equal(reads.length, 2)
})
