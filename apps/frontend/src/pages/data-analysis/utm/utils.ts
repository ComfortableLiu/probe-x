import dayjs from "dayjs"
import {
  IUtmAnalysisRow,
  IUtmOptionItem,
  UtmDimension,
  utmDimAlias,
} from "@probe-x/shared-types/src"

/**
 * 生成日期列表（YYYY-MM-DD）
 */
export function buildDateList(timeRange?: [string, string]): string[] {
  if (!timeRange?.[0] || !timeRange?.[1]) return []
  const dates: string[] = []
  for (let i = dayjs(timeRange[0]); i.isBefore(dayjs(timeRange[1])) || i.isSame(dayjs(timeRange[1])); i = i.add(1, 'day')) {
    dates.push(i.format('YYYY-MM-DD'))
  }
  return dates
}

/**
 * (维度, 取值) -> 别名
 * 键用 JSON 串，取值里带分隔符也不会撞
 */
export function buildUtmAliasMap(options: IUtmOptionItem[] = []): Record<string, string> {
  const map: Record<string, string> = {}
  options.forEach(item => {
    if (item.alias) map[aliasKey(item.dimension, item.value)] = item.alias
  })
  return map
}

function aliasKey(dimension: UtmDimension, value: string): string {
  return JSON.stringify([dimension, value])
}

/**
 * 取值展示：维护了别名给「别名（原始取值）」，否则直接给原始取值
 * 原始取值始终可见，与 UTM 管理页「英文取值为主、中文名在 hover」的约定一致
 */
export function formatUtmValue(
  dimension: UtmDimension,
  value: string | null | undefined,
  aliasMap: Record<string, string>,
): string {
  const raw = value ?? ''
  const alias = aliasMap[aliasKey(dimension, raw)]
  return alias ? `${alias}（${raw}）` : raw
}

/**
 * 取别名，没有则返回空串，供 Tooltip 用
 */
export function getUtmAlias(
  dimension: UtmDimension,
  value: string | null | undefined,
  aliasMap: Record<string, string>,
): string {
  return aliasMap[aliasKey(dimension, value ?? '')] || ''
}

/**
 * 分组行的展示名，趋势图系列名用
 */
export function formatUtmRowName(
  dimensions: UtmDimension[],
  row: IUtmAnalysisRow,
  aliasMap: Record<string, string>,
): string {
  return dimensions
    .map(dimension => formatUtmValue(dimension, row[utmDimAlias(dimension)] as string, aliasMap))
    .join(' / ')
}
