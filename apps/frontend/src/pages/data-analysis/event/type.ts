import { IEventAnalysisReq, IEventAnalysisRes } from "@probe-x/shared-types/src"

export interface IDataAnalysisEventState {
  // 数据更新时间
  updateTime?: Date
  // 现在查询出来的数据
  data?: IEventAnalysisRes
}

// url参数
export type IQuery = IEventAnalysisReq
