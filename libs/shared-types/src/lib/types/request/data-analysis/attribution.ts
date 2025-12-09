import { IAttributionAnalysisFilter } from "./common"
import { IEventAnalysisInfo } from "./event"

export enum AttributionModelEnum {
  // 首次触点归因
  FIRST_TOUCH = "first_touch",
  // 末次触点归因
  LAST_TOUCH = "last_touch",
  // 线性归因
  LINEAR = "linear",
  // 位置归因
  POSITION = "position",
  // 时间衰减归因
  TIME_DECAY = "time_decay",
}

// 归因分析请求入参
export interface IAttributionAnalysisReq {
  // 归因模式
  attributionModel: AttributionModelEnum
  // 转化目标指标
  targetMetric: {
    eventInfo: IEventAnalysisInfo
  }
  // 转化目标指标维度
  targetDimension: string[]
  // 时间范围
  timeRange: [`${string}-${string}-${string}`, `${string}-${string}-${string}`]
  // 指标维度，属性
  dimension: string[]
  // 全局筛选
  globalFilters?: IAttributionAnalysisFilter[]
}

// 漏斗分析请求返回值
export type IAttributionAnalysisRes = {
  [stepName: string]: number | string
}[]
