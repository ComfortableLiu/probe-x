const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { dirname, resolve } = require('node:path')
const Module = require('node:module')
const { test } = require('node:test')
const ts = require('typescript')
const { JSDOM } = require('jsdom')

// Run the real page component with local controls and deferred API promises.
// No application bootstrap, authentication, network, Redis, or browser is used.
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' })
global.window = dom.window
global.document = dom.window.document
global.HTMLElement = dom.window.HTMLElement
global.IS_REACT_ACT_ENVIRONMENT = true
const React = require('react')
const { createRoot } = require('react-dom/client')
const { act } = React
const h = React.createElement
let activeHarness

const controls = {
  Button: ({ children, onClick, disabled, loading }) => h('button', { onClick, disabled: disabled || loading }, children),
  Segmented: ({ options, value, onChange }) => h('select', {
    'aria-label': '日志级别', value, onChange: event => onChange(event.target.value),
  }, options.map(option => h('option', { key: option.value, value: option.value }, option.label))),
  Select: ({ options, value, onChange, 'aria-label': label }) => h('select', {
    'aria-label': label, value, onChange: event => onChange(Number(event.target.value)),
  }, options.map(option => h('option', { key: option.value, value: option.value }, option.label))),
  Switch: ({ checked, onChange, 'aria-label': label }) => h('button', {
    role: 'switch', 'aria-label': label, 'aria-checked': checked, onClick: () => onChange(!checked),
  }),
  Tag: ({ children }) => h('span', null, children),
  Alert: ({ type, message, description }) => h('div', { role: 'alert', 'data-type': type }, message, description),
}
const pageFile = resolve(__dirname, '../apps/frontend/src/pages/system-data/computing-node/components/log/index.tsx')
const pageModule = new Module(pageFile, module)
pageModule.filename = pageFile
pageModule.paths = Module._nodeModulePaths(dirname(pageFile))
const originalRequire = pageModule.require.bind(pageModule)
pageModule.require = request => {
  if (request === 'antd') return controls
  if (request === 'react-router-dom') return {
    useParams: () => ({ nodeId: activeHarness.nodeId }), useNavigate: () => () => {},
  }
  if (request === '@icon-park/react') return { ArrowLeft: () => null }
  if (request === '@components/PageHeader') return ({ title, onRefresh, loading, extra }) => h('header', null,
    h('h2', null, title), h('button', { onClick: onRefresh, disabled: loading, 'aria-label': '刷新日志' }, '刷新'), extra)
  if (request === '../../services') return { getComputingNodeLogs: (...args) => activeHarness.request(...args) }
  if (request === '../../utils') return { secondsAgo: () => '刚刚' }
  if (request.endsWith('.scss')) return new Proxy({ __esModule: true }, { get: (target, key) => target[key] || String(key) })
  return originalRequire(request)
}
pageModule._compile(ts.transpileModule(readFileSync(pageFile, 'utf8'), {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
    jsx: ts.JsxEmit.React, esModuleInterop: true,
  }, fileName: pageFile,
}).outputText, pageFile)
const ComputingNodeLogs = pageModule.exports.default

function log(message, id = message) {
  return { id, ts: 1792018800000, level: 'log', message }
}
function response(messages = ['latest'], options = {}) {
  return {
    nodeId: activeHarness.nodeId, entries: messages.map(message => log(message)),
    pageCursor: 'page-1', nextCursor: 'page-2', hasMore: true, retentionLimit: 2000,
    ...options,
  }
}
async function mount(t) {
  const originalSetInterval = global.setInterval
  const originalClearInterval = global.clearInterval
  const timers = new Map()
  let timerId = 0
  global.setInterval = callback => { timers.set(++timerId, callback); return timerId }
  global.clearInterval = id => timers.delete(id)
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  const harness = {
    nodeId: 'node-a', calls: [], host,
    request(nodeId, options) {
      let resolvePromise
      let rejectPromise
      const promise = new Promise((resolve, reject) => { resolvePromise = resolve; rejectPromise = reject })
      const call = { nodeId, options, resolve: resolvePromise, reject: rejectPromise }
      this.calls.push(call)
      return promise
    },
    text: () => host.textContent,
    panel: () => host.querySelector('[aria-label="当前页节点日志"]'),
    switch: () => host.querySelector('[role="switch"]'),
    button(text) {
      const button = [...host.querySelectorAll('button')].find(item => item.textContent === text || item.getAttribute('aria-label') === text)
      assert.ok(button, `missing button: ${text}`)
      return button
    },
    async click(text) {
      const button = typeof text === 'string' ? this.button(text) : text
      assert.equal(button.disabled, false, 'cannot click disabled control')
      await act(async () => { button.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })) })
    },
    async select(label, value) {
      await act(async () => {
        const select = host.querySelector(`select[aria-label="${label}"]`)
        select.value = String(value)
        select.dispatchEvent(new dom.window.Event('change', { bubbles: true }))
      })
    },
    async changeNode(nodeId) {
      this.nodeId = nodeId
      await act(async () => { root.render(h(ComputingNodeLogs)) })
    },
    async succeed(index, data) { await act(async () => { this.calls[index].resolve({ data }) }) },
    async fail(index, message) { await act(async () => { this.calls[index].reject(new Error(message)) }) },
    async tick() { await act(async () => { for (const callback of [...timers.values()]) callback() }) },
  }
  activeHarness = harness
  t.after(async () => {
    await act(async () => { root.unmount() })
    host.remove()
    global.setInterval = originalSetInterval
    global.clearInterval = originalClearInterval
    activeHarness = undefined
  })
  await act(async () => { root.render(h(ComputingNodeLogs)) })
  return harness
}

test('latest page requests 100 entries, replaces rows instead of accumulating, and skips overlapping polling', async t => {
  const page = await mount(t)
  assert.deepEqual(page.calls[0].options, { limit: 100, cursor: undefined, level: 'all' })
  await page.tick()
  assert.equal(page.calls.length, 1, 'initial request is still pending')
  await page.succeed(0, response(Array.from({ length: 100 }, (_, index) => `first-${index}`)))
  assert.equal(page.panel().children.length, 100)
  await page.tick()
  await page.tick()
  assert.equal(page.calls.length, 2, 'only one poll can be in flight')
  await page.succeed(1, response(['new-1', 'new-2']))
  assert.equal(page.panel().children.length, 2)
  assert.ok(!page.panel().textContent.includes('first-'))
})

test('node switch immediately hides old rows and rejects stale responses including errors/finally state', async t => {
  const page = await mount(t)
  await page.succeed(0, response(['node-a-old']))
  await page.tick()
  await page.changeNode('node-b')
  assert.equal(page.calls[2].nodeId, 'node-b')
  assert.ok(!page.panel().textContent.includes('node-a-old'))
  await page.fail(1, 'stale node-a error')
  assert.ok(!page.text().includes('stale node-a error'))
  assert.equal(page.panel().getAttribute('aria-busy'), 'true', 'old finally must not clear new loading state')
  await page.succeed(2, response(['node-b-new']))
  assert.ok(page.panel().textContent.includes('node-b-new'))
  assert.equal(page.panel().getAttribute('aria-busy'), 'false')
})

test('out-of-order filter requests cannot replace the active filter data or show stale errors', async t => {
  const page = await mount(t)
  await page.select('日志级别', 'warn')
  await page.select('日志级别', 'error')
  assert.deepEqual(page.calls.map(call => call.options.level), ['all', 'warn', 'error'])
  await page.succeed(2, response(['current-errors'], { hasMore: false, nextCursor: null }))
  await page.succeed(0, response(['stale-all']))
  await page.fail(1, 'stale warning error')
  assert.ok(page.panel().textContent.includes('current-errors'))
  assert.ok(!page.text().includes('stale-all'))
  assert.ok(!page.text().includes('stale warning error'))
  assert.equal(page.panel().getAttribute('aria-busy'), 'false')
})

test('failed older-page fetch preserves entries and page cursor, retry succeeds and newer page uses its original anchor', async t => {
  const page = await mount(t)
  await page.succeed(0, response(['latest-row']))
  await page.click('较早一页')
  assert.equal(page.calls[1].options.cursor, 'page-2')
  assert.equal(page.switch().getAttribute('aria-checked'), 'false')
  await page.fail(1, 'history failed')
  assert.ok(page.text().includes('第 1 页 · 本页 1 条'))
  assert.ok(page.panel().textContent.includes('latest-row'))
  assert.ok(page.text().includes('已保留当前页数据'))
  await page.click('较早一页')
  assert.equal(page.calls[2].options.cursor, 'page-2')
  await page.succeed(2, response(['older-row'], { pageCursor: 'page-2', nextCursor: 'page-3' }))
  assert.ok(page.text().includes('第 2 页 · 本页 1 条'))
  assert.ok(!page.panel().textContent.includes('latest-row'))
  await page.click('较新一页')
  assert.equal(page.calls[3].options.cursor, 'page-1')
  await page.succeed(3, response(['original-first-page']))
  assert.ok(page.text().includes('第 1 页 · 本页 1 条'))
})

test('historical pages stop polling and refresh only the current anchored page', async t => {
  const page = await mount(t)
  await page.succeed(0, response())
  await page.click('较早一页')
  await page.succeed(1, response(['history'], { pageCursor: 'page-2', nextCursor: 'page-3' }))
  await page.tick()
  await page.tick()
  assert.equal(page.calls.length, 2)
  await page.click('刷新日志')
  assert.equal(page.calls[2].options.cursor, 'page-2')
  await page.fail(2, 'refresh failed')
  assert.ok(page.text().includes('第 2 页 · 本页 1 条'))
  assert.ok(page.panel().textContent.includes('history'))
  await page.tick()
  assert.equal(page.calls.length, 3)
})

test('enabling follow from a historical page fetches latest once and resumes periodic replacement', async t => {
  const page = await mount(t)
  await page.succeed(0, response())
  await page.click('较早一页')
  await page.succeed(1, response(['history'], { pageCursor: 'page-2', nextCursor: 'page-3' }))
  await page.click(page.switch())
  assert.equal(page.calls[2].options.cursor, undefined)
  assert.equal(page.switch().getAttribute('aria-checked'), 'true')
  await page.succeed(2, response(['returned-latest']))
  assert.ok(page.text().includes('第 1 页 · 本页 1 条'))
  await page.tick()
  assert.equal(page.calls.length, 4)
  assert.equal(page.calls[3].options.cursor, undefined)
})

test('pausing follow invalidates an in-flight poll without replacing currently read entries', async t => {
  const page = await mount(t)
  await page.succeed(0, response(['reading']))
  await page.tick()
  await page.click(page.switch())
  assert.equal(page.panel().getAttribute('aria-busy'), 'false')
  await page.succeed(1, response(['late-poll']))
  assert.ok(page.panel().textContent.includes('reading'))
  assert.ok(!page.panel().textContent.includes('late-poll'))
  await page.tick()
  assert.equal(page.calls.length, 2)
})

test('changing filter and page size resets to latest but preserves paused follow preference', async t => {
  const page = await mount(t)
  await page.succeed(0, response())
  await page.click('较早一页')
  await page.succeed(1, response(['history'], { pageCursor: 'page-2', nextCursor: 'page-3' }))
  await page.select('日志级别', 'log')
  assert.equal(page.calls[2].options.cursor, undefined)
  assert.equal(page.calls[2].options.level, 'log')
  assert.equal(page.switch().getAttribute('aria-checked'), 'false')
  assert.ok(!page.panel().textContent.includes('history'))
  await page.succeed(2, response(['info-result']))
  await page.select('每页日志条数', 50)
  assert.deepEqual(page.calls[3].options, { cursor: undefined, limit: 50, level: 'log' })
  await page.succeed(3, response(['small-page']))
  assert.ok(page.text().includes('第 1 页 · 本页 1 条'))
  await page.tick()
  assert.equal(page.calls.length, 4)
})

test('expired history cursor retries latest once, displays reset notice, and remains paused', async t => {
  const page = await mount(t)
  await page.succeed(0, response(['previous']))
  await page.click('较早一页')
  await page.succeed(1, response([], { resetRequired: true }))
  assert.equal(page.calls.length, 3)
  assert.equal(page.calls[2].options.cursor, undefined)
  await page.succeed(2, response(['after-reset']))
  assert.ok(page.text().includes('第 1 页 · 本页 1 条'))
  assert.ok(page.text().includes('所选历史日志已超出留存范围'))
  assert.equal(page.switch().getAttribute('aria-checked'), 'false')
  assert.ok(page.panel().textContent.includes('after-reset'))
  await page.tick()
  assert.equal(page.calls.length, 3)
})

test('repeated expired cursor response stops after one retry and retains the previously successful page', async t => {
  const page = await mount(t)
  await page.succeed(0, response(['retained']))
  await page.click('较早一页')
  await page.succeed(1, response([], { resetRequired: true }))
  await page.succeed(2, response([], { resetRequired: true }))
  assert.equal(page.calls.length, 3)
  assert.ok(page.panel().textContent.includes('retained'))
  assert.ok(page.text().includes('第 1 页 · 本页 1 条'))
  assert.ok(page.text().includes('日志分页状态已失效'))
  assert.equal(page.panel().getAttribute('aria-busy'), 'false')
  await page.tick()
  assert.equal(page.calls.length, 3)
})

test('a node switch during expired-cursor recovery discards the old fallback response', async t => {
  const page = await mount(t)
  await page.succeed(0, response(['node-a-before']))
  await page.click('较早一页')
  await page.succeed(1, response([], { resetRequired: true }))
  await page.changeNode('node-b')
  assert.equal(page.calls[3].nodeId, 'node-b')
  await page.succeed(3, response(['node-b-current']))
  await page.succeed(2, response(['node-a-stale-reset']))
  assert.ok(page.panel().textContent.includes('node-b-current'))
  assert.ok(!page.panel().textContent.includes('node-a-stale-reset'))
  assert.ok(!page.text().includes('所选历史日志已超出留存范围'))
})
