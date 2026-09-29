import type { Redis } from 'ioredis'
import type { IServiceResourceSnapshot } from '@probe-x/shared-types/src'
export const REGISTRY_KEY: string
export const SNAPSHOT_PREFIX: string
export const RETENTION_SECONDS: number
export const OFFLINE_AFTER_MS: number
export class ServiceResourceMonitor {
  constructor(client: Redis, options: { serviceKey: string; targetPid?: number; onError?: (error: Error) => void })
  start(): void
  publish(): Promise<void>
  stop(): Promise<void>
}
export class ResourceSampler {
  constructor(targetPid?: number)
  sample(): Promise<Pick<IServiceResourceSnapshot, 'cpuUsage' | 'cpuCores' | 'memoryRssBytes' | 'heapUsedBytes' | 'uptimeSeconds' | 'processCount' | 'hostCpuUsage' | 'hostMemoryTotalBytes' | 'hostMemoryUsedBytes' | 'hostLoad1'>>
}
