import { IAttributionAnalysisReq, IAttributionAnalysisRes, AttributionModelEnum } from "@probe-x/shared-types/src"

/**
 * 模型对比单项数据
 */
export interface IModelComparisonItem {
  // 归因模型类型
  model: AttributionModelEnum
  // 该模型的查询结果
  data: IAttributionAnalysisRes
}

export interface IDataAnalysisAttributionState {
  // 数据更新时间
  updateTime?: Date
  // 现在查询出来的数据
  data?: IAttributionAnalysisRes
  // 多模型对比数据（并行查询5种模型的结果）
  modelComparisonData?: IModelComparisonItem[]
}

// url参数
export interface IQuery extends IAttributionAnalysisReq {
}
