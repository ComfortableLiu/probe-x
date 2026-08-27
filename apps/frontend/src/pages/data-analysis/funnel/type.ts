import { IFunnelAnalysisReq, IFunnelAnalysisRes } from "@probe-x/shared-types/src"

export interface IDataAnalysisFunnelState {
  // 数据更新时间
  updateTime?: Date
  // 现在查询出来的数据
  data?: IFunnelAnalysisRes
  // 本次查询使用的参数快照：图表据此渲染，避免配置项变更后结果区实时跟随
  querySnapshot?: IFunnelAnalysisReq
}

// url参数
export interface IQuery extends IFunnelAnalysisReq {
}
