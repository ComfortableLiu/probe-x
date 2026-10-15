const { fork } = require('node:child_process')
const { join } = require('node:path')

const PLUGIN_NAME = 'RestartServicePlugin'

/** 开发编译成功后替换本插件启动的服务，旧进程退出前绝不启动新进程。 */
class RestartServicePlugin {
  constructor({ name = 'main.js', shutdownTimeoutMs = 5000, forkProcess = fork } = {}) {
    this.name = name
    this.shutdownTimeoutMs = shutdownTimeoutMs
    this.forkProcess = forkProcess
    this.child = null
    this.requested = 0
    this.started = 0
    this.pending = null
    this.stopping = null
    this.closing = null
    this.closed = false
  }

  apply(compiler) {
    this.logger = compiler.getInfrastructureLogger(PLUGIN_NAME)
    compiler.hooks.afterEmit.tapPromise(PLUGIN_NAME, compilation => {
      const errors = compilation.getErrors ? compilation.getErrors() : compilation.errors
      if (errors?.length || this.closed) return Promise.resolve()
      this.filename = join(compiler.options.output.path, this.name)
      this.requested++
      if (!this.pending) {
        this.pending = this.restart().finally(() => { this.pending = null })
      }
      return this.pending
    })
    compiler.hooks.watchClose.tap(PLUGIN_NAME, () => {
      void this.close().catch(error => this.logger.error(error))
    })
    compiler.hooks.shutdown.tapPromise(PLUGIN_NAME, () => this.close())
  }

  async restart() {
    while (!this.closed && this.started < this.requested) {
      await this.stopChild()
      if (this.closed) return
      // 停止期间的多次重建合并为一次启动，始终读取最新的构建产物。
      this.started = this.requested
      const child = this.forkProcess(this.filename, [], {
        cwd: process.cwd(),
        env: process.env,
        stdio: 'inherit',
      })
      this.child = child
      child.once('exit', () => {
        if (this.child === child) this.child = null
      })
      child.on('error', error => {
        this.logger.error(error)
        // fork 启动失败不一定有 exit 事件，下次成功编译可以重新启动。
        if (!child.pid && this.child === child) this.child = null
      })
    }
  }

  stopChild() {
    if (this.stopping) return this.stopping
    const child = this.child
    if (!child) return Promise.resolve()
    if (child.exitCode !== null || child.signalCode !== null) {
      this.child = null
      return Promise.resolve()
    }

    this.stopping = new Promise((resolve, reject) => {
      let timer
      const exited = () => {
        clearTimeout(timer)
        if (this.child === child) this.child = null
        resolve()
      }
      child.once('exit', exited)
      timer = setTimeout(() => {
        // SIGKILL 后仍等待 exit，不能只发信号就抢占旧进程的监听端口。
        try { child.kill('SIGKILL') } catch (error) { reject(error) }
      }, this.shutdownTimeoutMs)
      timer.unref()
      try {
        child.kill('SIGTERM')
      } catch (error) {
        clearTimeout(timer)
        child.removeListener('exit', exited)
        reject(error)
      }
    }).finally(() => { this.stopping = null })
    return this.stopping
  }

  close() {
    if (this.closing) return this.closing
    this.closed = true
    this.closing = Promise.all([this.pending, this.stopChild()]).then(() => undefined)
    return this.closing
  }
}

module.exports = RestartServicePlugin
