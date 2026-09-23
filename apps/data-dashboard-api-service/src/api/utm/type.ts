import { UtmDimension } from '@probe-x/shared-types/src'

// BullMQ UTM 统计队列名称
export const QUEUE_NAME = 'utm-queue'
// 每日增量统计任务名称
export const QUEUE_TASK_NAME = 'utm-stat-daily'
// 单例调度器 ID（固定，重启不会重复注册多个调度）
export const UTM_STAT_SCHEDULER_ID = 'utm-stat-daily'
// 每日统计的 cron：凌晨 2:30（避开整点尖峰）
export const UTM_STAT_CRON = '30 2 * * *'
// 游标名称（sync_cursor 表的 name 列）
export const UTM_CURSOR_NAME = 'utm'
// 统计互斥锁 key，防止手动触发与定时任务并发双跑
export const UTM_STAT_LOCK_KEY = 'utm:stat:lock'
// 统计互斥锁过期秒数（兜底，正常结束时主动释放）
export const UTM_STAT_LOCK_TTL = 3600
// 批量 upsert 的分批大小
export const UTM_STAT_CHUNK_SIZE = 500

/**
 * ClickHouse 聚合结果的一行
 * event_count 是 UInt64，JSON 输出可能是数字也可能是字符串，统一按数字收
 */
export interface IUtmStatRow {
  dimension: UtmDimension
  value: string
  event_count: string | number
  first_seen_date: string
  last_seen_date: string
}

/**
 * 落库后的统计结果
 */
export interface IUtmPersistResult {
  // 扫描到的 (维度, 取值) 组合数
  scanned: number
  // 新插入的条目数
  inserted: number
  // 累加更新的条目数
  updated: number
  // 因软删除而跳过、未再计入的条目数
  skipped: number
}
