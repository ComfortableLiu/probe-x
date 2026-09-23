import { UtmDimension } from "../../entity"
import { Metrics } from "./event"
import { IAttributionAnalysisFilter } from "./common"

/**
 * UTM 取值筛选
 * 取值来自 UTM 管理维护的条目，前端下拉里带别名展示
 */
export interface IUtmValueFilter {
  // UTM 维度
  dimension: UtmDimension
  // 限定的取值列表，命中任一即算
  values: string[]
}

/**
 * UTM 分析请求入参
 * 按选定的 UTM 维度组合做交叉分析，输出各组合的指标
 */
export interface IUtmAnalysisReq {
  // 分组维度，1~5 个（对应 5 个 UTM 维度的联合查询）
  dimensions: UtmDimension[]
  // 查看的数据指标，至少一个
  metrics: Metrics[]
  // UTM 取值筛选
  utmFilters?: IUtmValueFilter[]
  // 时间范围
  timeRange: [`${string}-${string}-${string}`, `${string}-${string}-${string}`]
  // 全局筛选
  globalFilters?: IAttributionAnalysisFilter[]
}

/**
 * UTM 分析结果的一行
 * 列名即 SQL 别名，见下面的 utmDimAlias / utmMetricTotalAlias / utmMetricDateAlias
 */
export interface IUtmAnalysisRow {
  [key: string]: string | number | null | undefined
}

/**
 * UTM 分析请求返回值
 *
 * rows 是分组行；summary 是不分组的区间合计。
 * 合计必须单独给一份：用户数/会话数是 uniq 口径，按天列相加会重复计数，
 * 只有 summary 里的 _total 才是真正的区间去重值
 */
export interface IUtmAnalysisRes {
  rows: IUtmAnalysisRow[]
  summary: IUtmAnalysisRow
}

// ==================== 结果列别名规则 ====================
// SQL 生成侧与前端渲染侧共用这一份，避免两边各写一套后漂移

/**
 * 分组列别名，如 dim_source
 */
export function utmDimAlias(dimension: UtmDimension): string {
  return `dim_${dimension}`
}

/**
 * 指标区间合计列别名，如 m_USERS_total
 */
export function utmMetricTotalAlias(metric: Metrics): string {
  return `m_${metric}_total`
}

/**
 * 指标按天列别名，如 m_USERS_2025_09_20
 * @param date YYYY-MM-DD
 */
export function utmMetricDateAlias(metric: Metrics, date: string): string {
  return `m_${metric}_${date.replace(/-/g, '_')}`
}

/**
 * 从按天列别名反解日期，供前端按列名还原日期轴
 * 不匹配的列返回 null
 */
export function parseUtmMetricDateAlias(alias: string): string | null {
  const matched = /^m_[A-Z]+_(\d{4}_\d{2}_\d{2})$/.exec(alias)
  return matched ? matched[1].replace(/_/g, '-') : null
}
