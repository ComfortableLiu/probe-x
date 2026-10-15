const assert = require('node:assert/strict')
const { test } = require('node:test')
const { resolve } = require('node:path')

require('ts-node').register({ transpileOnly: true, skipProject: true, compilerOptions: {
  target: 'ES2022', module: 'CommonJS', moduleResolution: 'node', esModuleInterop: true, jsx: 'react',
} })
require('tsconfig-paths').register({ baseUrl: resolve(__dirname, '../apps/frontend'), paths: {
  '@pages/*': ['src/pages/*'], '@router/*': ['src/router/*'],
} })

const { guideCategories, guideEntries, getGuideContext, getLegacyGuidePath, normalizeGuidePath } = require('../apps/frontend/src/pages/guide/catalog.ts')
const guideRoute = require('../apps/frontend/src/router/page/Guide.tsx').default
const analysisRoutes = require('../apps/frontend/src/router/page/DataAnalysis.tsx').default
const systemRoutes = require('../apps/frontend/src/router/page/SystemData.tsx').default
const pointRoutes = require('../apps/frontend/src/router/page/PointManage.tsx').default

test('具体文档匹配叶子菜单和所属分类，不被父级前缀截获', () => {
  const { category, entry } = getGuideContext('/guide/data-analysis/event')
  assert.equal(category.key, 'data-analysis')
  assert.equal(entry.key, 'event')
  assert.equal(entry.label, '事件分析')
})

test('每篇文档在规范路径、尾斜线及自动生成的 html 别名下选中同一条目', () => {
  for (const category of guideCategories) {
    for (const entry of category.items) {
      for (const path of [entry.path, `${entry.path}/`, `${entry.path}.html`]) {
        assert.equal(getGuideContext(path).entry.key, entry.key)
        assert.equal(getGuideContext(path).category.key, category.key)
      }
    }
  }
})

test('说明首页别名被识别为首页，未知路径不会误选条目', () => {
  for (const path of ['/guide', '/guide/', '/guide.html']) assert.equal(normalizeGuidePath(path), '/guide')
  for (const path of ['/guide', '/guide/data-analysis', '/guide/data-analysis/event/unknown', '/guide/unknown']) {
    assert.equal(getGuideContext(path).entry, undefined)
  }
})

test('目录条目的菜单 key 和路径唯一，包含之前缺失的功能', () => {
  assert.equal(new Set(guideEntries.map(entry => entry.key)).size, guideEntries.length)
  assert.equal(new Set(guideEntries.map(entry => entry.path)).size, guideEntries.length)
  for (const key of ['utm', 'sql', 'meta', 'computing-node']) assert.ok(guideEntries.some(entry => entry.key === key))
})

test('目录与嵌套说明路由完全对应，没有失效的文档入口', () => {
  const paths = guideRoute.children.map(route => guideRoute.path + route.path).sort()
  assert.deepEqual(guideEntries.map(entry => entry.path).sort(), paths)
})

test('打开功能链接对应真实业务路由，包括 camelCase 路径', () => {
  const appPaths = new Set([analysisRoutes, systemRoutes, pointRoutes].flatMap(category => category.children.map(route => route.path)))
  for (const entry of guideEntries) assert.ok(appPaths.has(entry.appPath), entry.appPath)
  assert.equal(getGuideContext('/guide/data-analysis/user-path').entry.appPath, '/data-analysis/userPath')
  assert.equal(getGuideContext('/guide/system-data/computing-node').entry.appPath, '/system-data/computingNode')
})

test('旧说明地址映射到统一文档，未知 key 留给未找到页面处理', () => {
  assert.equal(getLegacyGuidePath('system-overview'), '/guide/system-data/overview')
  assert.equal(getLegacyGuidePath('system-analysis'), '/guide/system-data/analysis')
  for (const entry of guideEntries) assert.equal(getLegacyGuidePath(entry.key), entry.path)
  assert.equal(getLegacyGuidePath('unknown'), undefined)
  assert.equal(getLegacyGuidePath(), undefined)
})
