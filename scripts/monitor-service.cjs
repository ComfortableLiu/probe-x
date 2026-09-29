#!/usr/bin/env node
const { createResourceClient } = require('./service-resource-client.cjs')
const { ServiceResourceMonitor } = require('../libs/shared-utils/src/lib/backend-common/service-resource-monitor.cjs')

const args = Object.fromEntries(process.argv.slice(2).map(arg => {
  const index = arg.indexOf('=')
  return [arg.slice(0, index), arg.slice(index + 1)]
}))
const serviceKey = args['--service']
const targetPid = Number(args['--pid'])
if (!serviceKey || !/^[a-zA-Z0-9_-]{1,80}$/.test(serviceKey) || !Number.isSafeInteger(targetPid) || targetPid <= 0) {
  console.error('用法：node scripts/monitor-service.cjs --service=frontend --pid=<Web 服务主进程 PID>')
  process.exit(1)
}
if (process.platform === 'win32') {
  console.error('外部进程采集需要 Linux/macOS 的 ps；Node 服务可使用内置采集模块。')
  process.exit(1)
}
const client = createResourceClient()
const monitor = new ServiceResourceMonitor(client, { serviceKey, targetPid, onError: error => console.warn(`[服务资源] ${error.message}`) })
monitor.start()
client.on('ready', () => { void monitor.publish() })
let stopping = false
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => {
  if (stopping) return
  stopping = true
  await monitor.stop()
  client.disconnect()
})
