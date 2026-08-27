import dayjs, { Dayjs } from "dayjs"

// 相对时间预设 key
export enum RelativeTimeKey {
  TODAY = 'today',
  YESTERDAY = 'yesterday',
  LAST_7_DAYS = 'last_7_days',
  LAST_14_DAYS = 'last_14_days',
  LAST_30_DAYS = 'last_30_days',
}

// 时间选择值：相对预设（查询时动态解析）或绝对日期范围
export type ITimeSelection =
  | { type: 'relative', key: RelativeTimeKey }
  | { type: 'absolute', range: [string, string] }

// 卡片时间设置：默认跟随全局
export type ICardTimeSetting =
  | { mode: 'global' }
  | { mode: 'custom', selection: ITimeSelection }

// 默认全局时间：近 7 天
export const DEFAULT_TIME_SELECTION: ITimeSelection = {
  type: 'relative',
  key: RelativeTimeKey.LAST_7_DAYS,
}

// 相对时间预设列表（getRange 每次调用时取当前时间，保证相对时间始终是新值）
export const RELATIVE_TIME_PRESETS: { key: RelativeTimeKey, label: string, getRange: () => [Dayjs, Dayjs] }[] = [
  {
    key: RelativeTimeKey.TODAY,
    label: '今天',
    getRange: () => [dayjs().startOf('day'), dayjs().endOf('day')],
  },
  {
    key: RelativeTimeKey.YESTERDAY,
    label: '昨天',
    getRange: () => [dayjs().subtract(1, 'day').startOf('day'), dayjs().subtract(1, 'day').endOf('day')],
  },
  {
    key: RelativeTimeKey.LAST_7_DAYS,
    label: '近 7 天',
    getRange: () => [dayjs().subtract(6, 'day').startOf('day'), dayjs().endOf('day')],
  },
  {
    key: RelativeTimeKey.LAST_14_DAYS,
    label: '近 14 天',
    getRange: () => [dayjs().subtract(13, 'day').startOf('day'), dayjs().endOf('day')],
  },
  {
    key: RelativeTimeKey.LAST_30_DAYS,
    label: '近 30 天',
    getRange: () => [dayjs().subtract(29, 'day').startOf('day'), dayjs().endOf('day')],
  },
]

/**
 * 解析为具体日期范围（YYYY-MM-DD）
 * 相对时间每次调用时动态解析，保证 60s 轮询时「近 7 天」始终是新值
 */
export function resolveTimeRange(selection: ITimeSelection): [string, string] {
  if (selection.type === 'absolute') return selection.range
  const preset = RELATIVE_TIME_PRESETS.find(item => item.key === selection.key)
    || RELATIVE_TIME_PRESETS.find(item => item.key === RelativeTimeKey.LAST_7_DAYS)!
  const [start, end] = preset.getRange()
  return [start.format('YYYY-MM-DD'), end.format('YYYY-MM-DD')]
}

// 时间选择的展示文案
export function getTimeSelectionLabel(selection: ITimeSelection): string {
  if (selection.type === 'relative') {
    return RELATIVE_TIME_PRESETS.find(item => item.key === selection.key)?.label || '近 7 天'
  }
  return `${selection.range[0]} ~ ${selection.range[1]}`
}

/**
 * 解析并校验时间选择（URL query / localStorage 反序列化后的值不可信，需校验）
 * 非法时返回 null，由调用方回退到默认值
 */
export function parseTimeSelection(value: unknown): ITimeSelection | null {
  if (!value || typeof value !== 'object') return null
  const selection = value as ITimeSelection
  if (selection.type === 'relative' && RELATIVE_TIME_PRESETS.some(item => item.key === selection.key)) {
    return { type: 'relative', key: selection.key }
  }
  if (
    selection.type === 'absolute'
    && Array.isArray(selection.range)
    && selection.range.length === 2
    && selection.range.every(date => typeof date === 'string' && dayjs(date).isValid())
  ) {
    return { type: 'absolute', range: [selection.range[0], selection.range[1]] }
  }
  return null
}

/**
 * 解析并校验卡片时间设置 map（{ [dashboardId]: ICardTimeSetting }）
 */
export function parseCardTimeMap(value: unknown): Record<number, ICardTimeSetting> {
  if (!value || typeof value !== 'object') return {}
  const result: Record<number, ICardTimeSetting> = {}
  Object.entries(value).forEach(([id, setting]) => {
    const dashboardId = Number(id)
    if (!Number.isFinite(dashboardId) || !setting || typeof setting !== 'object') return
    const cardSetting = setting as ICardTimeSetting
    if (cardSetting.mode === 'custom') {
      const selection = parseTimeSelection((cardSetting as { selection?: unknown }).selection)
      if (selection) result[dashboardId] = { mode: 'custom', selection }
    }
    // mode 为 global 与缺省等价，无需保留
  })
  return result
}
