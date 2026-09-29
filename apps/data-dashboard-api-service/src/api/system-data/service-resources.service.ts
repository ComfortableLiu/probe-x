import { Injectable } from '@nestjs/common'
import { RedisService } from '@probe-x/shared-utils/src/lib/backend-common'
import type { IServiceResourceGroup, IServiceResourceSnapshot } from '@probe-x/shared-types/src'
import { OFFLINE_AFTER_MS, REGISTRY_KEY, RETENTION_SECONDS, SNAPSHOT_PREFIX } from '@probe-x/shared-utils/src/lib/backend-common/service-resource-monitor.cjs'

const SERVICES: Record<string, string> = {
  frontend: 'Web 前端服务',
  'data-dashboard-api-service': '仪表板 API 服务',
  'receiving-point-service': '埋点接收服务',
  'preliminary-data-processing-service': '初步数据处理服务',
  'final-data-cleaning-service': '最终清洗服务',
}

export function groupServiceResources(raw: Array<string | null>, now = Date.now()): IServiceResourceGroup[] {
  const groups = new Map<string, IServiceResourceGroup>(Object.entries(SERVICES).map(([serviceKey, serviceName]) => [serviceKey, { serviceKey, serviceName, instances: [] }]))
  for (const json of raw) {
    if (!json) continue
    let snapshot: IServiceResourceSnapshot
    try { snapshot = JSON.parse(json) } catch { continue }
    if (!snapshot || typeof snapshot.serviceKey !== 'string' || !snapshot.serviceKey
      || typeof snapshot.instanceId !== 'string' || typeof snapshot.hostname !== 'string'
      || !Number.isFinite(snapshot.sampledAt) || snapshot.sampledAt > now + 5000
      || now - snapshot.sampledAt > RETENTION_SECONDS * 1000) continue
    const required = [snapshot.pid, snapshot.cpuCores, snapshot.memoryRssBytes, snapshot.uptimeSeconds,
      snapshot.processCount, snapshot.hostMemoryTotalBytes, snapshot.hostMemoryUsedBytes]
    const optional = [snapshot.cpuUsage, snapshot.heapUsedBytes, snapshot.hostCpuUsage, snapshot.hostLoad1]
    if (required.some(value => !Number.isFinite(value) || value < 0)
      || optional.some(value => value !== null && (!Number.isFinite(value) || value < 0))) continue
    if (!groups.has(snapshot.serviceKey)) groups.set(snapshot.serviceKey, { serviceKey: snapshot.serviceKey, serviceName: snapshot.serviceKey, instances: [] })
    groups.get(snapshot.serviceKey).instances.push({
      ...snapshot,
      status: !snapshot.stoppedAt && now - snapshot.sampledAt <= OFFLINE_AFTER_MS ? 'online' : 'offline',
    })
  }
  for (const group of groups.values()) {
    const byHostname = new Map<string, IServiceResourceGroup['instances']>()
    for (const instance of group.instances) {
      const siblings = byHostname.get(instance.hostname)
      if (siblings) siblings.push(instance)
      else byHostname.set(instance.hostname, [instance])
    }
    group.instances = [...byHostname.values()].flatMap(instances => {
      const online = instances.filter(instance => instance.status === 'online')
      if (online.length) return online
      return [instances.reduce((latest, instance) => instance.sampledAt > latest.sampledAt ? instance : latest)]
    })
    group.instances.sort((a, b) => a.hostname.localeCompare(b.hostname) || a.pid - b.pid || a.instanceId.localeCompare(b.instanceId))
  }
  return [...groups.values()]
}

@Injectable()
export class ServiceResourcesService {
  constructor(private readonly redisService: RedisService) {}

  async getResources(now = Date.now()): Promise<IServiceResourceGroup[]> {
    const client = this.redisService.getClient()
    if (client.status !== 'ready') throw new Error('监控 Redis 未就绪')
    const ids = await client.zrangebyscore(REGISTRY_KEY, now - RETENTION_SECONDS * 1000, '+inf')
    const samples: Array<string | null> = []
    for (let index = 0; index < ids.length; index += 100) {
      samples.push(...await client.mget(...ids.slice(index, index + 100).map(id => SNAPSHOT_PREFIX + id)))
    }
    return groupServiceResources(samples, now)
  }
}
