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

// 归因分析请求返回值
export interface IAttributionAnalysisRes {
  // 归因维度层级数据
  data: IAttributionDimensionNode[]
  // 总计数据
  total: {
    // 转化指标值
    conversionValue: number
    // 总贡献率
    totalContributionRate: number
    // 转化率
    conversionRate: number
  }
  // 维度列表
  dimensions: string[]
  // 归因模型
  attributionModel: AttributionModelEnum
}

/**
 * 归因维度节点
 */
export interface IAttributionDimensionNode {
  // 维度名称
  dimensionName: string
  // 维度值
  dimensionValue: string
  // 子维度节点
  children?: IAttributionDimensionNode[]
  // 转化指标值
  conversionValue: number
  // 贡献率（百分比）
  contributionRate: number
  // 转化率
  conversionRate: number
}
