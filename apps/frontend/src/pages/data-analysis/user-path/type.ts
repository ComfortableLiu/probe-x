import { IUserPathAnalysisReq, IUserPathAnalysisRes } from "@probe-x/shared-types/src"

export interface IDataAnalysisUserPathState {
  // 数据更新时间
  updateTime?: Date
  // 现在查询出来的数据
  data?: IUserPathAnalysisRes
}

// url参数
export interface IQuery extends IUserPathAnalysisReq {
}
