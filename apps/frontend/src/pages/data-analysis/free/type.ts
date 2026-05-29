import { IFreeAnalysisReq, IFreeAnalysisRes } from "@probe-x/shared-types/src"

export interface IDataAnalysisFreeState {
  // 数据更新时间
  updateTime?: Date
  // 现在查询出来的数据
  data?: IFreeAnalysisRes
}

// url参数
export type IQuery = IFreeAnalysisReq
