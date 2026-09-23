import {
  IUtmAnalysisReq,
  IUtmAnalysisRes,
  IUtmOptionItem,
  IUtmValueFilter,
  Metrics,
} from "@probe-x/shared-types/src"

/**
 * 指标展示名
 */
export const METRIC_LABEL: Record<Metrics, string> = {
  [Metrics.COUNT]: "事件数",
  [Metrics.USERS]: "用户数",
  [Metrics.SESSIONS]: "会话数",
}

/**
 * 指标选项，下拉用
 */
export const METRIC_OPTIONS = [
  { label: METRIC_LABEL[Metrics.COUNT], value: Metrics.COUNT },
  { label: METRIC_LABEL[Metrics.USERS], value: Metrics.USERS },
  { label: METRIC_LABEL[Metrics.SESSIONS], value: Metrics.SESSIONS },
]

export interface IDataAnalysisUtmState {
  // 数据更新时间
  updateTime?: Date
  // 现在查询出来的数据
  data?: IUtmAnalysisRes
  // 本次查询使用的参数快照：图表/表格据此渲染，避免配置项变更后结果区实时跟随
  querySnapshot?: IUtmAnalysisReq
  // UTM 取值选项，取值筛选器下拉与表格别名展示都用它
  utmOptions?: IUtmOptionItem[]
}

// url参数
export type IQuery = IUtmAnalysisReq

export type { IUtmAnalysisReq, IUtmAnalysisRes, IUtmOptionItem, IUtmValueFilter }
