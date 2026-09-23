/**
 * UTM 维度枚举
 *
 * 管理侧按维度分别管理：一个维度下的一个取值即一条可管理记录
 * （例如 `utm_source=google` 是一条、`utm_medium=cpc` 是另一条），
 * 未来的 UTM 分析再做 5 个维度的联合查询。
 */
export enum UtmDimension {
  // 流量来源
  SOURCE = 'source',
  // 流量媒介
  MEDIUM = 'medium',
  // 营销活动
  CAMPAIGN = 'campaign',
  // 搜索关键词
  TERM = 'term',
  // 广告内容
  CONTENT = 'content',
}

/**
 * 维度展示名（表格列与筛选下拉用）
 */
export const UTM_DIMENSION_LABEL: Record<UtmDimension, string> = {
  [UtmDimension.SOURCE]: '来源',
  [UtmDimension.MEDIUM]: '媒介',
  [UtmDimension.CAMPAIGN]: '活动',
  [UtmDimension.TERM]: '关键词',
  [UtmDimension.CONTENT]: '内容',
}

/**
 * 维度的完整展示名，带 ClickHouse 列名，筛选下拉用
 */
export const UTM_DIMENSION_OPTION_LABEL: Record<UtmDimension, string> = {
  [UtmDimension.SOURCE]: '来源（utm_source）',
  [UtmDimension.MEDIUM]: '媒介（utm_medium）',
  [UtmDimension.CAMPAIGN]: '活动（utm_campaign）',
  [UtmDimension.TERM]: '关键词（utm_term）',
  [UtmDimension.CONTENT]: '内容（utm_content）',
}

/**
 * 全部维度，顺序与聚合 SQL 的 arrayJoin 保持一致
 */
export const UTM_DIMENSIONS: UtmDimension[] = [
  UtmDimension.SOURCE,
  UtmDimension.MEDIUM,
  UtmDimension.CAMPAIGN,
  UtmDimension.TERM,
  UtmDimension.CONTENT,
]
