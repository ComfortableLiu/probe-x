import { IEventAnalysisReq, IEventAnalysisRes } from "@probe-x/shared-types/src"

export interface IDataAnalysisEventState {
  // 数据更新时间
  updateTime?: Date
  // 现在查询出来的数据
  data?: IEventAnalysisRes
  // 本次查询使用的参数快照：图表/表格据此渲染，避免配置项变更后结果区实时跟随
  querySnapshot?: IEventAnalysisReq
}

// url参数
export type IQuery = IEventAnalysisReq
