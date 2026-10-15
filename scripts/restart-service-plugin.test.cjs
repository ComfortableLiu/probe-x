const assert = require('node:assert/strict')
const { EventEmitter } = require('node:events')
const { test } = require('node:test')
const { setTimeout: delay } = require('node:timers/promises')
const { join } = require('node:path')
const RestartServicePlugin = require('./restart-service-plugin.cjs')

class FakeChild extends EventEmitter {
  constructor(pid) {
    super()
    this.pid = pid
    this.exitCode = null
    this.signalCode = null
    this.signals = []
  }

  kill(signal) {
    this.signals.push(signal)
    return true
  }

  exit(code = 0) {
    if (this.exitCode !== null || this.signalCode !== null) return
    this.exitCode = code
    this.emit('exit', code, null)
  }
}

const nextTurn = () => new Promise(resolve => setImmediate(resolve))
const successfulCompilation = () => ({ getErrors: () => [] })

function setup(t, options = {}) {
  const children = []
  const starts = []
  const errors = []
  const hooks = {}
  let maxLive = 0
  const plugin = new RestartServicePlugin({
    forkProcess(filename, args, forkOptions) {
      const child = new FakeChild(children.length + 1)
      children.push(child)
      starts.push({ filename, args, options: forkOptions })
      maxLive = Math.max(maxLive, children.filter(item => item.exitCode === null).length)
      return child
    },
    ...options,
  })
  plugin.apply({
    options: { output: { path: join(__dirname, 'test-output') } },
    getInfrastructureLogger: () => ({ error: error => errors.push(error) }),
    hooks: {
      afterEmit: { tapPromise: (_, handler) => { hooks.afterEmit = handler } },
      watchClose: { tap: (_, handler) => { hooks.watchClose = handler } },
      shutdown: { tapPromise: (_, handler) => { hooks.shutdown = handler } },
    },
  })
  t.after(async () => {
    const closing = plugin.close()
    children.forEach(child => child.exit())
    await closing
  })
  return { plugin, hooks, children, starts, errors, maxLive: () => maxLive }
}

test('首次成功编译启动 main.js，继承工作目录、环境和标准输入输出', async t => {
  const { hooks, starts } = setup(t)
  await hooks.afterEmit(successfulCompilation())
  assert.equal(starts.length, 1)
  assert.equal(starts[0].filename, join(__dirname, 'test-output/main.js'))
  assert.deepEqual(starts[0].args, [])
  assert.equal(starts[0].options.cwd, process.cwd())
  assert.equal(starts[0].options.env, process.env)
  assert.equal(starts[0].options.stdio, 'inherit')
})

test('重建先 SIGTERM 并等待旧子进程 exit，再 fork 新服务，进程不重叠', async t => {
  const { hooks, children, starts, maxLive } = setup(t)
  await hooks.afterEmit(successfulCompilation())
  const rebuilding = hooks.afterEmit(successfulCompilation())
  await nextTurn()
  assert.deepEqual(children[0].signals, ['SIGTERM'])
  assert.equal(starts.length, 1)
  children[0].exit()
  await rebuilding
  assert.equal(starts.length, 2)
  assert.equal(maxLive(), 1)
})

test('等待退出期间的连续重建合并启动一次，不重复 fork 或重复发送终止信号', async t => {
  const { hooks, children, starts, maxLive } = setup(t)
  await hooks.afterEmit(successfulCompilation())
  const builds = [
    hooks.afterEmit(successfulCompilation()),
    hooks.afterEmit(successfulCompilation()),
    hooks.afterEmit(successfulCompilation()),
  ]
  await nextTurn()
  assert.equal(starts.length, 1)
  assert.deepEqual(children[0].signals, ['SIGTERM'])
  children[0].exit()
  await Promise.all(builds)
  assert.equal(starts.length, 2)
  assert.equal(maxLive(), 1)
})

test('编译有错误不停止健康服务，也不会在首次失败时启动服务', async t => {
  const { hooks, children, starts } = setup(t)
  const failed = { getErrors: () => [new Error('compile failed')] }
  await hooks.afterEmit(failed)
  assert.equal(starts.length, 0)
  await hooks.afterEmit(successfulCompilation())
  await hooks.afterEmit(failed)
  await hooks.afterEmit({ errors: [new Error('legacy compilation failure')] })
  assert.equal(starts.length, 1)
  assert.deepEqual(children[0].signals, [])
})

test('退出超时后发送 SIGKILL，仍等待 exit 再启动新进程', async t => {
  const { hooks, children, starts } = setup(t, { shutdownTimeoutMs: 15 })
  await hooks.afterEmit(successfulCompilation())
  const rebuilding = hooks.afterEmit(successfulCompilation())
  await delay(30)
  assert.deepEqual(children[0].signals, ['SIGTERM', 'SIGKILL'])
  assert.equal(starts.length, 1)
  children[0].exit()
  await rebuilding
  assert.equal(starts.length, 2)
})

test('watchClose 关闭自己启动的服务，重复关闭与后续编译不会再次启动', async t => {
  const { hooks, children, starts } = setup(t)
  await hooks.afterEmit(successfulCompilation())
  hooks.watchClose()
  hooks.watchClose()
  assert.deepEqual(children[0].signals, ['SIGTERM'])
  children[0].exit()
  await hooks.shutdown()
  await hooks.afterEmit(successfulCompilation())
  assert.equal(starts.length, 1)
})

test('重建等待期间关闭 watcher，旧进程退出后不再启动替代进程', async t => {
  const { hooks, children, starts } = setup(t)
  await hooks.afterEmit(successfulCompilation())
  const rebuilding = hooks.afterEmit(successfulCompilation())
  hooks.watchClose()
  const shutdown = hooks.shutdown()
  assert.deepEqual(children[0].signals, ['SIGTERM'])
  children[0].exit()
  await Promise.all([rebuilding, shutdown])
  assert.equal(starts.length, 1)
})

test('服务自行退出后下一次成功编译可恢复，不向已退出进程发送信号', async t => {
  const { hooks, children, starts } = setup(t)
  await hooks.afterEmit(successfulCompilation())
  children[0].exit(1)
  await hooks.afterEmit(successfulCompilation())
  assert.equal(starts.length, 2)
  assert.deepEqual(children[0].signals, [])
})

test('首次编译等待启动时关闭 watcher，不遗留新子进程', async t => {
  const { hooks, starts } = setup(t)
  const starting = hooks.afterEmit(successfulCompilation())
  hooks.watchClose()
  await Promise.all([starting, hooks.shutdown()])
  assert.equal(starts.length, 0)
})

test('fork 异步启动失败无 exit 时不会卡住下一次重建', async t => {
  const { hooks, children, starts, errors } = setup(t)
  await hooks.afterEmit(successfulCompilation())
  children[0].pid = undefined
  children[0].emit('error', new Error('spawn failed'))
  await hooks.afterEmit(successfulCompilation())
  assert.equal(starts.length, 2)
  assert.equal(errors[0].message, 'spawn failed')
  assert.deepEqual(children[0].signals, [])
})
