const assert = require('node:assert/strict')
const { test } = require('node:test')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')

require('ts-node').register({
  transpileOnly: true,
  skipProject: true,
  compilerOptions: {
    target: 'ES2022',
    module: 'CommonJS',
    moduleResolution: 'node',
    esModuleInterop: true,
    jsx: 'react',
  },
})

const { CleaningRateProgress, CleaningRateStatistic } = require('../apps/frontend/src/pages/system-data/meta/cleaning-rate.tsx')
const render = (component, props) => renderToStaticMarkup(React.createElement(component, props))

test('overview without execution samples shows a dash without a percent suffix', () => {
  const html = render(CleaningRateStatistic, { title: '清洗成功率', rate: null })
  assert.match(html, /—/)
  assert.doesNotMatch(html, /ant-statistic-content-suffix/)
  assert.doesNotMatch(html, /0\.00/)
})

test('real zero success rate remains 0.00 percent in the overview', () => {
  const html = render(CleaningRateStatistic, { title: '清洗成功率', rate: 0 })
  assert.match(html, /ant-statistic-content-value-int">0</)
  assert.match(html, /ant-statistic-content-value-decimal">\.00</)
  assert.match(html, /ant-statistic-content-suffix">%</)
  assert.doesNotMatch(html, /—/)
})

test('a successful observed run is rendered as 100.00 percent', () => {
  const html = render(CleaningRateStatistic, { title: '清洗成功率', rate: 100 })
  assert.match(html, /ant-statistic-content-value-int">100</)
  assert.match(html, /ant-statistic-content-suffix">%</)
})

test('detail without execution samples does not render a misleading zero progress bar', () => {
  const html = render(CleaningRateProgress, { rate: null })
  assert.match(html, /—（暂无采样）/)
  assert.doesNotMatch(html, /role="progressbar"/)
  assert.doesNotMatch(html, /0%/)
})

test('detail with genuine zero success rate still renders a zero progress bar', () => {
  const html = render(CleaningRateProgress, { rate: 0 })
  assert.match(html, /role="progressbar"/)
  assert.match(html, /aria-valuenow="0"/)
  assert.match(html, /0%/)
  assert.doesNotMatch(html, /暂无采样/)
})

test('missing and non-finite rates are treated as unavailable samples', () => {
  for (const rate of [undefined, NaN, Infinity]) {
    const statistic = render(CleaningRateStatistic, { title: '清洗成功率', rate })
    const progress = render(CleaningRateProgress, { rate })
    assert.match(statistic, /—/)
    assert.doesNotMatch(statistic, /ant-statistic-content-suffix/)
    assert.match(progress, /暂无采样/)
    assert.doesNotMatch(progress, /role="progressbar"/)
  }
})
