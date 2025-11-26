// 用户路径分析请求入参
import { IAttributionAnalysisFilter } from "./common"

export interface IUserPathAnalysisReq {
  // 需要分析的事件列表
  eventList: string[];
  // 开始事件，与结束事件互斥
  startEvent?: string;
  // 结束事件，与开始事件互斥
  endEvent?: string;
  // 时间范围
  timeRange: [`${string}-${string}-${string}`, `${string}-${string}-${string}`]
  // 全局筛选
  globalFilters?: IAttributionAnalysisFilter[]
}

// 用户路径分析请求返回值
export interface IUserPathAnalysisRes {
  // 事件列表
  eventList: string[];
  // 边表
  edgeList: {
    source: string
    target: string
    value: number
  }[]
}
