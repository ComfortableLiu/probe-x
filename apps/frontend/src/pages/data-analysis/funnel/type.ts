import { IFunnelAnalysisReq, IFunnelAnalysisRes } from "@probe-x/shared-types/src"

export interface IDataAnalysisFunnelState {
  // 数据更新时间
  updateTime?: Date
  // 现在查询出来的数据
  data?: IFunnelAnalysisRes
}

// url参数
export interface IQuery extends IFunnelAnalysisReq {
}
