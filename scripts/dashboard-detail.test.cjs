const assert = require('node:assert/strict')
const { test } = require('node:test')
const { resolve } = require('node:path')
require('ts-node').register({ transpileOnly: true, skipProject: true, compilerOptions: {
  target: 'ES2022', module: 'CommonJS', moduleResolution: 'node', esModuleInterop: true, jsx: 'react',
} })
require('tsconfig-paths').register({ baseUrl: resolve(__dirname, '../apps/frontend'), paths: {
  '@/*': ['src/*'], '@pages/*': ['src/pages/*'],
} })
const { AnalysisType } = require('@probe-x/shared-types/src')
const { buildDetailUrl } = require('../apps/frontend/src/pages/dashboard/utils.ts')
const { RelativeTimeKey, resolveTimeRange } = require('../apps/frontend/src/pages/dashboard/time.ts')
const { getParamsOrQuery } = require('../apps/frontend/src/utils/router.ts')

const cases = [
  [AnalysisType.EVENT, 'eventAnalysis', '/data-analysis/event'],
  [AnalysisType.FUNNEL, 'funnelAnalysis', '/data-analysis/funnel'],
  [AnalysisType.USER_PATH, 'userPathAnalysis', '/data-analysis/userPath'],
  [AnalysisType.ATTRIBUTION, 'attributionAnalysis', '/data-analysis/attribution'],
  [AnalysisType.UTM, 'utmAnalysis', '/data-analysis/utm'],
]
const savedRange = ['2026-09-01', '2026-09-07']
function dashboard(type = AnalysisType.EVENT, key = 'eventAnalysis', config = {}) {
  return { id: 42, analysisType: type, config: { [key]: {
    timeRange: savedRange,
    eventInfoList: [{ eventName: 'page_view', metrics: 'count' }],
    globalFilters: [{ propertyName: '$utm_source', value: '搜索 & 社交' }],
    dimension: ['$device'],
    ...config,
  } } }
}
function parsed(url) {
  const target = new URL(url, 'http://localhost')
  return { path: target.pathname, query: getParamsOrQuery(target.search) }
}

for (const [type, key, path] of cases) {
  test(`${type} 查看详情使用卡片生效日期并保持其它分析条件`, () => {
    const item = dashboard(type, key)
    const effectiveRange = ['2026-10-08', '2026-10-14']
    const target = parsed(buildDetailUrl(item, effectiveRange))
    assert.equal(target.path, path)
    assert.deepEqual(target.query.timeRange, effectiveRange)
    assert.equal(Number(target.query.dashboardId), item.id)
    assert.deepEqual(target.query.eventInfoList, item.config[key].eventInfoList)
    assert.deepEqual(target.query.globalFilters, item.config[key].globalFilters)
    assert.deepEqual(target.query.dimension, item.config[key].dimension)
    assert.deepEqual(item.config[key].timeRange, savedRange, '查看详情不能改写保存的配置')
  })
}

test('跟随全局的近7天原样传入详情，避免回退到分析页默认8天', t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-10-15T12:00:00+08:00') })
  const effectiveRange = resolveTimeRange({ type: 'relative', key: RelativeTimeKey.LAST_7_DAYS })
  const target = parsed(buildDetailUrl(dashboard(), effectiveRange))
  assert.deepEqual(effectiveRange, ['2026-10-09', '2026-10-15'])
  assert.deepEqual(target.query.timeRange, effectiveRange)
})

test('卡片单独选择的单日优先于保存日期和全局范围', () => {
  const target = parsed(buildDetailUrl(dashboard(), ['2026-10-14', '2026-10-14']))
  assert.deepEqual(target.query.timeRange, ['2026-10-14', '2026-10-14'])
})

test('未保存日期时仍传入卡片当前日期，不让目标页自行填默认日期', () => {
  const target = parsed(buildDetailUrl(dashboard(AnalysisType.EVENT, 'eventAnalysis', { timeRange: undefined }), ['2026-10-01', '2026-10-03']))
  assert.deepEqual(target.query.timeRange, ['2026-10-01', '2026-10-03'])
})

test('未提供覆盖日期的调用保持保存配置，空配置仍不可跳转', () => {
  assert.deepEqual(parsed(buildDetailUrl(dashboard())).query.timeRange, savedRange)
  assert.equal(buildDetailUrl({ id: 1, analysisType: AnalysisType.EVENT, config: {} }, ['2026-10-14', '2026-10-14']), null)
  assert.equal(buildDetailUrl({ id: 1, analysisType: 'unknown', config: {} }, ['2026-10-14', '2026-10-14']), null)
})

test('日期覆盖不修改冻结的看板配置和输入数组', () => {
  const item = dashboard()
  Object.freeze(item.config.eventAnalysis.timeRange)
  Object.freeze(item.config.eventAnalysis)
  Object.freeze(item.config)
  const range = Object.freeze(['2026-10-10', '2026-10-15'])
  assert.deepEqual(parsed(buildDetailUrl(item, range)).query.timeRange, range)
})
