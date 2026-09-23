import type { ComputingNodeLight, IComputeNodeLinkInfo } from './type'

/** 状态灯颜色，与 ComputingNodeTree / 图例保持一致 */
export const statusLightColorMap: Record<ComputingNodeLight, string> = {
  healthy_idle: '#4ade80', // 绿色灯光 - 健康空闲
  healthy_busy: '#fbbf24', // 黄色灯光 - 健康忙碌
  error: '#f87171', // 红色灯光 - 错误
  offline: '#9ca3af', // 灰色灯光 - 离线
}

export const statusLightLabelMap: Record<ComputingNodeLight, string> = {
  healthy_idle: '健康空闲',
  healthy_busy: '健康忙碌',
  error: '错误',
  offline: '离线',
}

export const linkLabelMap: Record<IComputeNodeLinkInfo['link'], string> = {
  connected: '已连接',
  connecting: '连接中',
  disconnected: '已断开',
}

/**
 * 真实链接态 → 页面状态灯
 *
 * 离线优先判定（连不上就不该显示忙碌），之后红灯表示「最近一次任务失败且此后没有新进展」。
 */
export const resolveNodeLight = (node: IComputeNodeLinkInfo): ComputingNodeLight => {
  if (node.link !== 'connected') return 'offline'
  if (node.lastError) return 'error'
  return node.busy ? 'healthy_busy' : 'healthy_idle'
}

/** 「x 秒前」/「x 分 y 秒前」 */
export const secondsAgo = (timestamp: number | null, now: number): string => {
  if (!timestamp) return '从未'
  const seconds = Math.max(0, Math.round((now - timestamp) / 1000))
  return seconds < 60 ? `${seconds} 秒前` : `${Math.floor(seconds / 60)} 分 ${seconds % 60} 秒前`
}

/** 时长，如「1 小时 2 分 3 秒」 */
export const formatDuration = (from: number | null, now: number): string => {
  if (!from) return '—'
  const seconds = Math.max(0, Math.round((now - from) / 1000))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const rest = seconds % 60
  if (hours > 0) return `${hours} 小时 ${minutes} 分 ${rest} 秒`
  return minutes > 0 ? `${minutes} 分 ${rest} 秒` : `${rest} 秒`
}

/** 「可用 x MB / 共 y MB」 */
export const formatMemory = (available: number, total: number): string =>
  total > 0 ? `可用 ${available} MB / 共 ${total} MB` : '—'
