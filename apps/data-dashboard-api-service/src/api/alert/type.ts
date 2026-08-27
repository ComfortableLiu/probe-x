// BullMQ 告警队列名称
export const QUEUE_NAME = 'alert-queue'
// 全量规则扫描任务名称
export const QUEUE_TASK_NAME = 'alert-scan'
// 单例扫描任务调度器 ID（固定，避免重复注册多个调度）
export const ALERT_SCAN_SCHEDULER_ID = 'alert-scan-all-rules'
// 扫描周期（毫秒）
export const ALERT_SCAN_INTERVAL = 60 * 1000

/** Webhook 通知负载 */
export interface IAlertWebhookPayload {
  ruleId: number
  ruleName: string
  eventName: string
  windowMinutes: number
  operator: string
  threshold: number
  metricValue: number
  level: string
  triggeredAt: string
}
