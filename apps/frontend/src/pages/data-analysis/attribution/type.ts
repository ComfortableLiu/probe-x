import { IAttributionAnalysisReq, IAttributionAnalysisRes } from "@probe-x/shared-types/src"

export interface IDataAnalysisAttributionState {
  // 数据更新时间
  updateTime?: Date
  // 现在查询出来的数据
  data?: IAttributionAnalysisRes
}

// url参数
export interface IQuery extends IAttributionAnalysisReq {
}
