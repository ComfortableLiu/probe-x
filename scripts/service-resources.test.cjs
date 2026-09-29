const assert = require('node:assert/strict')
const { test } = require('node:test')
const os = require('node:os')
const { ResourceSampler, ServiceResourceMonitor, SNAPSHOT_PREFIX, parseElapsed, parseProcessTable, processTree } = require('../libs/shared-utils/src/lib/backend-common/service-resource-monitor.cjs')
require('reflect-metadata')
require('ts-node').register({ transpileOnly: true, skipProject: true, compilerOptions: {
  target: 'ES2022', module: 'CommonJS', moduleResolution: 'node', experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true,
} })
const { groupServiceResources, ServiceResourcesService } = require('../apps/data-dashboard-api-service/src/api/system-data/service-resources.service.ts')

function memoryClient() {
  const data = new Map()
  const scores = new Map()
  const client = {
    status: 'ready', data, scores,
    async set(key, value) { data.set(key, value); return 'OK' },
    async mget(...keys) { return keys.map(key => data.get(key) || null) },
    async zrangebyscore(key, min) { return [...scores].filter(([, score]) => score >= min).map(([id]) => id) },
    multi() {
      const ops = []
      const tx = {
        set(key, value) { ops.push(() => client.set(key, value)); return tx },
        zadd(key, time, id) { ops.push(() => scores.set(id, time)); return tx },
        zremrangebyscore(key, min, max) { ops.push(() => { for (const [id, score] of scores) if (score <= max) scores.delete(id) }); return tx },
        async exec() { return Promise.all(ops.map(async op => [null, await op()])) },
      }
      return tx
    },
  }
  return client
}

test('sampler distinguishes first CPU baseline from zero and measures real process memory', async () => {
  const sampler = new ResourceSampler()
  const first = await sampler.sample()
  assert.equal(first.cpuUsage, null)
  assert.equal(first.hostCpuUsage, null)
  assert.ok(first.memoryRssBytes > 0)
  assert.ok(first.heapUsedBytes > 0)
  assert.equal(first.cpuCores, os.cpus().length)
  assert.ok(first.hostMemoryUsedBytes <= first.hostMemoryTotalBytes)
  const second = await sampler.sample()
  assert.ok(Number.isFinite(second.cpuUsage))
  assert.ok(second.cpuUsage >= 0)
})

test('ps times and process trees include workers without unrelated processes', () => {
  assert.equal(parseElapsed('01:02.50'), 62.5)
  assert.equal(parseElapsed('2-03:04:05'), 183845)
  const rows = parseProcessTable('100 1 00:10 4096 01:00\n101 100 00:05 2048 00:30\n102 101 00:01 1024 00:10\n103 1 00:10 1024 01:00')
  assert.deepEqual(processTree(rows, 100).map(row => row.pid), [100, 101, 102])
  assert.equal(rows[0].rss, 4096 * 1024)
})

test('multiple replicas remain distinct, heartbeats expire and a stopped replica is hidden while a sibling stays online', async () => {
  const client = memoryClient()
  const a = new ServiceResourceMonitor(client, { serviceKey: 'frontend' })
  const b = new ServiceResourceMonitor(client, { serviceKey: 'frontend' })
  await a.publish()
  await b.publish()
  const service = new ServiceResourcesService({ getClient: () => client })
  const groups = await service.getResources()
  assert.equal(groups.length, 5)
  const web = groups.find(group => group.serviceKey === 'frontend')
  assert.equal(web.instances.length, 2)
  assert.notEqual(web.instances[0].instanceId, web.instances[1].instanceId)
  assert.ok(web.instances.every(instance => instance.status === 'online'))
  const expired = groupServiceResources([...client.data.values()], Date.now() + 45001)
  assert.ok(expired.find(group => group.serviceKey === 'frontend').instances.every(instance => instance.status === 'offline'))
  await a.stop()
  const remaining = (await service.getResources()).find(group => group.serviceKey === 'frontend').instances
  assert.equal(remaining.length, 1)
  assert.equal(remaining[0].instanceId, b.instanceId)
  assert.equal(remaining[0].status, 'online')
})

test('a restarted service only shows the new instance, dropping the stopped previous one', async () => {
  const client = memoryClient()
  const service = new ServiceResourcesService({ getClient: () => client })
  const before = new ServiceResourceMonitor(client, { serviceKey: 'receiving-point-service' })
  await before.publish()
  await before.stop()
  const after = new ServiceResourceMonitor(client, { serviceKey: 'receiving-point-service' })
  await after.publish()
  const instances = (await service.getResources()).find(group => group.serviceKey === 'receiving-point-service').instances
  assert.equal(instances.length, 1)
  assert.equal(instances[0].instanceId, after.instanceId)
  assert.equal(instances[0].status, 'online')
})

test('a fully stopped service keeps only its most recently sampled instance', async () => {
  const client = memoryClient()
  const service = new ServiceResourcesService({ getClient: () => client })
  const first = new ServiceResourceMonitor(client, { serviceKey: 'final-data-cleaning-service' })
  await first.publish()
  await first.stop()
  await new Promise(resolve => setTimeout(resolve, 5))
  const second = new ServiceResourceMonitor(client, { serviceKey: 'final-data-cleaning-service' })
  await second.publish()
  await second.stop()
  const instances = (await service.getResources()).find(group => group.serviceKey === 'final-data-cleaning-service').instances
  assert.equal(instances.length, 1)
  assert.equal(instances[0].instanceId, second.instanceId)
  assert.equal(instances[0].status, 'offline')
})

test('known but never reported services are empty, corrupt/old/future snapshots are ignored', async () => {
  const client = memoryClient()
  const monitor = new ServiceResourceMonitor(client, { serviceKey: 'frontend' })
  await monitor.publish()
  const snapshot = JSON.parse([...client.data.values()][0])
  const raw = [null, '{invalid', JSON.stringify({ ...snapshot, sampledAt: Date.now() - 86400001 }), JSON.stringify({ ...snapshot, sampledAt: Date.now() + 60000 }), JSON.stringify({ ...snapshot, cpuUsage: 'fake' })]
  const groups = groupServiceResources(raw)
  assert.equal(groups.length, 5)
  assert.ok(groups.every(group => group.instances.length === 0))
})

test('registry reads are batched and missing Redis surfaces an unavailable data source', async () => {
  const client = memoryClient()
  for (let i = 0; i < 205; i++) client.scores.set(`missing-${i}`, Date.now())
  const batches = []
  client.mget = async (...keys) => { batches.push(keys.length); return keys.map(() => null) }
  const service = new ServiceResourcesService({ getClient: () => client })
  await service.getResources()
  assert.deepEqual(batches, [100, 100, 5])
  client.status = 'reconnecting'
  await assert.rejects(service.getResources(), /未就绪/)
})

test('Redis outages never escape into application flow and warnings are rate limited', async () => {
  const client = memoryClient()
  client.status = 'reconnecting'
  const errors = []
  const monitor = new ServiceResourceMonitor(client, { serviceKey: 'test-service', onError: error => errors.push(error) })
  await monitor.publish()
  await monitor.publish()
  assert.equal(errors.length, 1)
  assert.equal(client.data.size, 0)
  client.status = 'ready'
  await monitor.publish()
  assert.equal(client.data.size, 1)
})

test('stopping during a pending sample cannot publish an online heartbeat afterward', async () => {
  const client = memoryClient()
  const monitor = new ServiceResourceMonitor(client, { serviceKey: 'frontend' })
  let release
  const sampler = monitor.sampler
  monitor.sampler = { external: false, sample: () => new Promise(resolve => { release = async () => resolve(await sampler.sample()) }) }
  const publish = monitor.publish()
  const stopping = monitor.stop()
  await release()
  await Promise.all([publish, stopping])
  assert.equal(client.data.size, 0)
  assert.equal([...client.data.keys()].filter(key => key.startsWith(SNAPSHOT_PREFIX)).length, 0)
})

test('standalone sampler measures an actual external process without attributing the agent heap', { skip: process.platform === 'win32' }, async () => {
  const { spawn } = require('node:child_process')
  const { once } = require('node:events')
  const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' })
  try {
    await once(child, 'spawn')
    const sampler = new ResourceSampler(child.pid)
    const first = await sampler.sample()
    assert.equal(first.heapUsedBytes, null)
    assert.equal(first.cpuUsage, null)
    assert.ok(first.memoryRssBytes > 0)
    assert.ok(first.processCount >= 1)
    const second = await sampler.sample()
    assert.ok(Number.isFinite(second.cpuUsage))
  } finally {
    const exited = once(child, 'exit')
    child.kill('SIGTERM')
    await exited
  }
})
