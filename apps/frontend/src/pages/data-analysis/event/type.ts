import { EventAnalysisReq } from "@probe-x/shared-types/src"

export interface IDataAnalysisEventState {
  // 数据更新时间
  updateTime?: Date
}

// url参数
export type IQuery = EventAnalysisReq
