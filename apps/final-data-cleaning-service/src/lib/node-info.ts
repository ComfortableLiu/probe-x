import os from 'node:os'
import fs from 'node:fs'
import type { NodeInfo } from '@probe-x/shared-types/src'

export type { NodeInfo }
const toMB = (bytes: number) => Math.round(bytes / 1024 / 1024)
let previous: { idle: number; total: number; network: number | null; at: number } | null = null

function networkBytes(): number | null {
  // Linux hosts expose interface counters; unsupported hosts explicitly report unavailable.
  try {
    return fs.readFileSync('/proc/net/dev', 'utf8').split('\n').slice(2).reduce((sum, line) => {
      const [name, raw] = line.split(':')
      if (!raw || name.trim() === 'lo') return sum
      const values = raw.trim().split(/\s+/).map(Number)
      return sum + values[0] + values[8]
    }, 0)
  } catch {
    return null
  }
}

/** Heartbeat CPU deltas, physical memory, 1-minute load, and RX+TX interface deltas. */
export const collectNodeInfo = (busyTaskId: string): NodeInfo => {
  const cpus = os.cpus()
  const idle = cpus.reduce((sum, cpu) => sum + cpu.times.idle, 0)
  const total = cpus.reduce((sum, cpu) => sum + Object.values(cpu.times).reduce((a, b) => a + b, 0), 0)
  const network = networkBytes()
  const at = performance.now()
  const resourceSampled = !!previous && total > previous.total && os.platform() !== 'win32'
  const networkSampled = !!previous && network !== null && previous.network !== null && network >= previous.network && at > previous.at
  const info: NodeInfo = {
    cpu_count: cpus.length,
    memory_size: toMB(os.totalmem()),
    available_memory_size: toMB(os.freemem()),
    available: true,
    busy: Boolean(busyTaskId),
    busy_task_id: busyTaskId,
    resource_sampled: resourceSampled,
    cpu_usage: resourceSampled ? Math.max(0, Math.min(100, (1 - (idle - previous.idle) / (total - previous.total)) * 100)) : 0,
    load_average: os.loadavg()[0],
    network_sampled: networkSampled,
    network_bytes_per_second: networkSampled ? (network - previous.network) / ((at - previous.at) / 1000) : 0,
  }
  previous = { idle, total, network, at }
  return info
}
