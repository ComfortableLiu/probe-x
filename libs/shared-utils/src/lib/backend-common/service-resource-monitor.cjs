// Server-only sampler, shared by Nest services, the Web dev server and the standalone agent.
const os = require('node:os')
const { randomUUID } = require('node:crypto')
const { execFile } = require('node:child_process')
const { promisify } = require('node:util')
const execFileAsync = promisify(execFile)
const REGISTRY_KEY = 'probe-x:overview:v1:services'
const SNAPSHOT_PREFIX = `${REGISTRY_KEY}:instance:`
const RETENTION_SECONDS = 86400
const OFFLINE_AFTER_MS = 45000

function parseElapsed(value) {
  const [days, time] = value.includes('-') ? value.split('-') : ['0', value]
  const parts = time.split(':').map(Number)
  if (!parts.length || parts.some(n => !Number.isFinite(n))) return null
  return Number(days) * 86400 + parts.reduce((sum, n) => sum * 60 + n, 0)
}

function parseProcessTable(text) {
  return text.trim().split('\n').filter(Boolean).map(line => {
    const [pid, ppid, cpu, rss, elapsed] = line.trim().split(/\s+/)
    return { pid: Number(pid), ppid: Number(ppid), cpu: parseElapsed(cpu), rss: Number(rss) * 1024, uptime: parseElapsed(elapsed) }
  }).filter(row => row.pid > 0 && row.cpu !== null && Number.isFinite(row.rss))
}

function processTree(rows, pid) {
  const selected = new Set([pid])
  let previousSize
  do {
    previousSize = selected.size
    for (const row of rows) if (selected.has(row.ppid)) selected.add(row.pid)
  } while (selected.size !== previousSize)
  return rows.filter(row => selected.has(row.pid))
}

class ResourceSampler {
  constructor(targetPid) {
    this.targetPid = targetPid || process.pid
    this.external = Boolean(targetPid && targetPid !== process.pid)
    this.previous = null
  }

  async sample() {
    const at = performance.now()
    const cpus = os.cpus()
    const idle = cpus.reduce((sum, cpu) => sum + cpu.times.idle, 0)
    const total = cpus.reduce((sum, cpu) => sum + Object.values(cpu.times).reduce((a, b) => a + b, 0), 0)
    let processes, rss, heapUsed, uptime
    if (this.external) {
      const { stdout } = await execFileAsync('ps', ['-A', '-o', 'pid=,ppid=,time=,rss=,etime='], { timeout: 3000, maxBuffer: 8 * 1024 * 1024 })
      const rows = parseProcessTable(stdout)
      const root = rows.find(row => row.pid === this.targetPid)
      if (!root) throw new Error('目标进程已退出')
      processes = processTree(rows, this.targetPid)
      rss = processes.reduce((sum, row) => sum + row.rss, 0)
      heapUsed = null
      uptime = root.uptime
    } else {
      const cpu = process.cpuUsage()
      const memory = process.memoryUsage()
      processes = [{ pid: process.pid, cpu: (cpu.user + cpu.system) / 1e6 }]
      rss = memory.rss
      heapUsed = memory.heapUsed
      uptime = process.uptime()
    }
    const previous = this.previous
    const elapsed = previous ? (at - previous.at) / 1000 : 0
    let cpuUsage = null
    if (elapsed > 0) {
      // A new child needs a baseline; exited children do not produce negative CPU usage.
      const delta = processes.reduce((sum, row) => {
        const old = previous.processes.find(item => item.pid === row.pid)
        return sum + (old ? Math.max(0, row.cpu - old.cpu) : 0)
      }, 0)
      cpuUsage = delta / elapsed * 100
    }
    this.previous = { at, idle, total, processes }
    const totalMemory = os.totalmem()
    return {
      cpuUsage,
      cpuCores: cpus.length,
      memoryRssBytes: rss,
      heapUsedBytes: heapUsed,
      uptimeSeconds: uptime,
      processCount: processes.length,
      hostCpuUsage: previous && total > previous.total ? Math.max(0, Math.min(100, (1 - (idle - previous.idle) / (total - previous.total)) * 100)) : null,
      hostMemoryTotalBytes: totalMemory,
      hostMemoryUsedBytes: totalMemory - os.freemem(),
      hostLoad1: os.platform() === 'win32' ? null : os.loadavg()[0],
    }
  }
}

class ServiceResourceMonitor {
  constructor(client, options) {
    this.client = client
    this.options = options
    this.sampler = new ResourceSampler(options.targetPid)
    this.instanceId = `${options.serviceKey}:${os.hostname()}:${options.targetPid || process.pid}:${randomUUID()}`
    this.timer = null
    this.pending = null
    this.stopped = false
    this.lastWarning = 0
    this.snapshot = null
  }

  start() {
    if (this.timer) return
    this.stopped = false
    void this.publish()
    this.timer = setInterval(() => { void this.publish() }, 10000)
    this.timer.unref()
  }

  async publish() {
    if (this.stopped || this.pending) return this.pending
    this.pending = (async () => {
      const resource = await this.sampler.sample()
      if (this.stopped) return
      if (this.client.status !== 'ready') throw new Error('监控 Redis 未就绪')
      const now = Date.now()
      const snapshot = {
        ...resource,
        instanceId: this.instanceId,
        serviceKey: this.options.serviceKey,
        hostname: os.hostname(),
        pid: this.options.targetPid || process.pid,
        scope: this.sampler.external ? 'process-tree' : 'process',
        sampledAt: now,
        stoppedAt: null,
      }
      const result = await this.client.multi()
        .set(SNAPSHOT_PREFIX + this.instanceId, JSON.stringify(snapshot), 'EX', RETENTION_SECONDS)
        .zadd(REGISTRY_KEY, now, this.instanceId)
        .zremrangebyscore(REGISTRY_KEY, '-inf', now - RETENTION_SECONDS * 1000)
        .exec()
      if (!result || result.some(([error]) => error)) throw new Error('服务资源写入失败')
      this.snapshot = snapshot
    })().catch(error => {
      if (Date.now() - this.lastWarning > 60000) {
        this.lastWarning = Date.now()
        this.options.onError?.(error)
      }
    }).finally(() => { this.pending = null })
    return this.pending
  }

  async stop() {
    this.stopped = true
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    await this.pending
    if (this.snapshot && this.client.status === 'ready') {
      await this.client.set(SNAPSHOT_PREFIX + this.instanceId,
        JSON.stringify({ ...this.snapshot, stoppedAt: Date.now() }), 'EX', RETENTION_SECONDS).catch(() => {})
    }
  }
}

module.exports = { ResourceSampler, ServiceResourceMonitor, REGISTRY_KEY, SNAPSHOT_PREFIX, RETENTION_SECONDS, OFFLINE_AFTER_MS, parseElapsed, parseProcessTable, processTree }
