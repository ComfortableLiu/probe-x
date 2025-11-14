import { MetaPropertyType } from "../../entity"

// 事件列表
export interface IEventAnalysisInfo {
  // 事件名
  eventName?: string
  // 过滤条件
  filters?: IAttributionAnalysisFilter[]
  // 查看的数据指标
  metrics: Metrics
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

// 数据指标
export enum Metrics {
  // 数量
  COUNT = 'COUNT',
  // 用户数
  USERS = 'USERS',
  // 会话数
  SESSIONS = 'SESSIONS',
}

// 事件分析请求入参
export interface IEventAnalysisReq {
  // 事件部分
  eventInfoList: IEventAnalysisInfo[]
  // 时间范围
  timeRange: [`${string}-${string}-${string}`, `${string}-${string}-${string}`]
  // 指标维度，属性
  dimension: string[]
  // 全局筛选
  globalFilters?: IAttributionAnalysisFilter[]
}

// 1. 定义基础类型别名（可根据实际业务调整）
type DimensionKey = string; // 维度 key 类型（第一层、第二层等动态层级的 key）
type EventKey = string; // 事件名
type DateKey = string; // 日期 key 类型（"日期1"/"2025-11-13"...）
type NumericValue = number; // 最终数值类型

// 2. 最内层：日期-数字映射
type DateValueMap = Record<DateKey, NumericValue>;

// 3. 倒数第二层：Event 到日期映射的映射
type EventLayer = Record<EventKey, DateValueMap>;

// 4. 递归类型：动态维度层（支持 N 层嵌套，最终指向 EventLayer）
export type DimensionLayer = {
  [key in DimensionKey]: DimensionLayer | EventLayer;
};

// 事件分析请求返回值
export type IEventAnalysisRes = DimensionLayer

// 提交数据下载请求入参
export type ISubmitDownloadTaskReq = IEventAnalysisReq

// 提交数据下载请求返回值
export interface ISubmitDownloadTaskRes {
  taskId: string
}

// 提交数据下载请求入参
export interface IQueryDownloadTaskReq {
  taskId: string
}

// 提交数据下载请求返回值
export interface IQueryDownloadTaskRes {
  status: 'SUCCESS' | 'FAIL' | 'RUNNING'
  downloadUrl?: string
}
