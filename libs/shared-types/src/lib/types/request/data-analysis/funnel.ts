import { IAttributionAnalysisFilter } from "./common"
import { IEventAnalysisInfo } from "./event"

// 漏斗类型
export enum FunnelTypeEnum {
  // 人数
  USER = 'user',
  // 次数
  COUNT = 'count',
}

export interface IFunnelInfo {
  // 步骤名称
  stepName: string
  // 事件
  eventInfo: IEventAnalysisInfo
}

// 漏斗分析请求入参
export interface IFunnelAnalysisReq {
  // 漏斗类型
  funnelType: FunnelTypeEnum
  // 窗口期
  windowPeriod: {
    // 数字
    value: number
    // 单位
    unit: 'm' | 'h' | 'd'
  }
  // 漏斗数据
  funnelInfoList: IFunnelInfo[]
  // 时间范围
  timeRange: [`${string}-${string}-${string}`, `${string}-${string}-${string}`]
  // 指标维度，属性
  dimension: string[]
  // 全局筛选
  globalFilters?: IAttributionAnalysisFilter[]
}

// 漏斗分析请求返回值
export interface IFunnelAnalysisRes {
}
