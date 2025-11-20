import { MetaPropertyType } from "../../entity"

// 漏斗分析请求入参
export interface IFunnelAnalysisReq {
  // 窗口期
  windowPeriod: {
    // 数字
    value: number
    // 单位
    unit: 'm' | 'h' | 'd'
  }
  // 时间范围
  timeRange: [`${string}-${string}-${string}`, `${string}-${string}-${string}`]
  // 指标维度，属性
  dimension: string[]
  // 全局筛选
  globalFilters?: IAttributionAnalysisFilter[]
}

// 属性过滤条件
export interface IAttributionAnalysisFilter {
  // 属性名
  propertyName: string
  // 属性类型
  propertyType: MetaPropertyType
  // 属性值
  propertyValue: string | number | string[] | number[]
  // 比较方式
  compareType: CompareType
}

// 筛选条件类型的文字
export const CompareText = {
  EQUAL: '等于',
  NOT_EQUAL: '不等于',
  GREATER_THAN: '大于',
  GREATER_THAN_OR_EQUAL: '大于等于',
  LESS_THAN: '小于',
  LESS_THAN_OR_EQUAL: '小于等于',
  RANGE: '区间',
  CONTAINS: '包含',
  NOT_CONTAINS: '不包含',
  REGEX: '匹配正则',
}

// 筛选条件类型
export type CompareType = keyof typeof CompareText


// 漏斗分析请求返回值
export interface IFunnelAnalysisRes {
}
