import { format } from 'node:util'
import type { NodeLogEntry, NodeLogLevel } from '@probe-x/shared-types/src'

/** 待上行缓冲容量，溢出丢最旧（断连期间的总服务不可达是常态，日志不应撑爆内存） */
export const NODE_LOG_BUFFER_CAP = 500
/** 单次上行携带的最大条数 */
export const NODE_LOG_DRAIN_MAX = 200

const CAPTURED_LEVELS: NodeLogLevel[] = ['log', 'info', 'warn', 'error', 'debug']

const pending: NodeLogEntry[] = []
const originals = new Map<NodeLogLevel, (...args: unknown[]) => void>()
let installed = false

/**
 * 包装 console.log/info/warn/error/debug：原样打印 + 追加到待上行缓冲。
 *
 * NestJS 内置 Logger 底层走 console，因此在 NestFactory.create 之前调用一次，
 * 即可同时覆盖 Logger 输出与直连 console 的日志。幂等，重复调用无副作用。
 */
export function installNodeLogCapture(): void {
  if (installed) return
  installed = true

  for (const level of CAPTURED_LEVELS) {
    const original = console[level].bind(console)
    originals.set(level, original)
    console[level] = (...args: unknown[]) => {
      try {
        pending.push({ ts: Date.now(), level, message: format(...args) })
        if (pending.length > NODE_LOG_BUFFER_CAP) {
          pending.splice(0, pending.length - NODE_LOG_BUFFER_CAP)
        }
      } catch {
        // 缓冲失败不影响原始输出
      }
      original(...args)
    }
  }
}

/** 取出并清除至多 max 条待上行日志（按时间升序） */
export function drainNodeLogs(max = NODE_LOG_DRAIN_MAX): NodeLogEntry[] {
  return pending.splice(0, Math.max(0, max))
}

/** 当前待上行条数（测试与调试用） */
export function pendingNodeLogCount(): number {
  return pending.length
}

/** 还原 console 并清空缓冲：仅供单测使用，生产路径不应调用 */
export function resetNodeLogCapture(): void {
  for (const [level, original] of originals) {
    console[level] = original
  }
  originals.clear()
  pending.length = 0
  installed = false
}
