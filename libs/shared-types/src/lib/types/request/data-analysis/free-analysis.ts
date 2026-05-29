import { IAttributionAnalysisFilter } from "./common"
import { IEventAnalysisInfo, GenericEventAnalysisResult } from "./event"

// 自由分析请求入参
// 结构与 IEventAnalysisReq 一致，复用事件分析的 SQL 生成能力
export interface IFreeAnalysisReq {
  // 事件部分
  eventInfoList: IEventAnalysisInfo[]
  // 时间范围
  timeRange: [`${string}-${string}-${string}`, `${string}-${string}-${string}`]
  // 指标维度，属性
  dimension: string[]
  // 全局筛选
  globalFilters?: IAttributionAnalysisFilter[]
}

// 自由分析请求返回值（复用事件分析的通用结果类型）
export type IFreeAnalysisRes = GenericEventAnalysisResult[]
