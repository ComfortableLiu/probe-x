import { IAttributionAnalysisFilter } from "./common"

/**
 * 留存分析时间粒度
 */
export enum RetentionGranularity {
  // 按日
  DAY = 'DAY',
  // 按周
  WEEK = 'WEEK',
  // 按月
  MONTH = 'MONTH',
}

/**
 * 留存分析请求入参
 */
export interface IRetentionAnalysisReq {
  // 起始事件（用户首次触发的事件）
  startEvent: {
    eventName: string
    filters?: IAttributionAnalysisFilter[]
  }
  // 回访事件（用于判断留存的事件）
  returnEvent: {
    eventName: string
    filters?: IAttributionAnalysisFilter[]
  }
  // 时间范围
  timeRange: [`${string}-${string}-${string}`, `${string}-${string}-${string}`]
  // 留存窗口天数列表（如 [1, 3, 7, 14, 30] 表示次日、3日、7日、14日、30日留存）
  retentionWindows: number[]
  // 时间粒度
  granularity: RetentionGranularity
  // 维度（用于分组，如按用户属性分组）
  dimension?: string[]
  // 全局筛选
  globalFilters?: IAttributionAnalysisFilter[]
}

/**
 * 单个留存窗口数据
 */
export interface IRetentionWindowData {
  // 窗口天数
  day: number
  // 留存用户数
  retentionUsers: number
  // 留存率（百分比）
  retentionRate: number
}

/**
 * 单个队列（cohort）的留存数据
 */
export interface IRetentionCohortData {
  // 队列日期
  cohortDate: string
  // 队列用户数（起始事件的用户数）
  cohortSize: number
  // 各窗口的留存数据
  windows: IRetentionWindowData[]
  // 维度值（如果有分组）
  dimensionValues?: Record<string, string>
}

/**
 * 留存分析响应
 */
export interface IRetentionAnalysisRes {
  // 留存曲线数据
  cohorts: IRetentionCohortData[]
  // 汇总数据
  summary: {
    // 总用户数
    totalUsers: number
    // 平均留存率（按窗口）
    avgRetentionRates: IRetentionWindowData[]
  }
}
