import os from 'node:os'
import type { NodeInfo } from '@probe-x/shared-types/src'

// 形状与 proto 的 NodeInfo 一一对应，类型统一由 shared-types 维护
export type { NodeInfo }

const toMB = (bytes: number) => Math.round(bytes / 1024 / 1024)

/**
 * 采集当前节点的资源与运行状态
 * @param busyTaskId 当前正在执行的任务 id，空串表示空闲
 */
export const collectNodeInfo = (busyTaskId: string): NodeInfo => ({
  cpu_count: os.cpus().length,
  memory_size: toMB(os.totalmem()),
  available_memory_size: toMB(os.freemem()),
  available: true,
  busy: Boolean(busyTaskId),
  busy_task_id: busyTaskId,
})
