import { IAttributionAnalysisFilter, IRetentionAnalysisRes, RetentionGranularity } from "@probe-x/shared-types/src"

/**
 * 留存事件配置（起始事件/回访事件）
 */
export interface IRetentionEventConfig {
  // 事件名
  eventName: string
  // 过滤条件
  filters?: IAttributionAnalysisFilter[]
}

export interface IDataAnalysisRetentionState {
  // 数据更新时间
  updateTime?: Date
  // 现在查询出来的数据
  data?: IRetentionAnalysisRes
  // 本次查询使用的参数快照：图表/表格据此渲染，避免配置项变更后结果区实时跟随
  querySnapshot?: IQuery
}

// url参数
export interface IQuery {
  // 起始事件（用户首次触发的事件）
  startEvent?: IRetentionEventConfig
  // 回访事件（用于判断留存的事件）
  returnEvent?: IRetentionEventConfig
  // 时间范围
  timeRange?: [`${string}-${string}-${string}`, `${string}-${string}-${string}`]
  // 留存窗口列表（如 [1, 3, 7, 14, 30]，窗口单位跟随时间粒度：按日表示第 N 日留存，按周/月表示第 N 周/月留存）
  retentionWindows?: number[]
  // 时间粒度
  granularity?: RetentionGranularity
  // 数据维度
  dimension?: string[]
  // 全局筛选
  globalFilters?: IAttributionAnalysisFilter[]
}
