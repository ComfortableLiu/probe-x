import { IAttributionAnalysisFilter } from "./common"

// 事件列表
export interface IEventAnalysisInfo {
  // 事件名
  eventName?: string
  // 过滤条件
  filters?: IAttributionAnalysisFilter[]
  // 查看的数据指标
  metrics: Metrics
}

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

/**
 * 通用事件分析结果类型（非严格推导，适用于运行时动态处理）
 */
export interface GenericEventAnalysisResult {
  // 维度字段（动态，实际字段由入参 dimension 决定）
  // 事件名字段（如 event_0_page_leave）
  // 事件-日期指标字段（如 event_0_page_leave_2025_11_05）
  [key: string]: string | number | null | undefined;
}

// 事件分析请求返回值
export type IEventAnalysisRes = GenericEventAnalysisResult[]

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
