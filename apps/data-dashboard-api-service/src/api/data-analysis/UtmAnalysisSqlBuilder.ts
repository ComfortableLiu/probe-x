import {
  IAttributionAnalysisFilter,
  IUtmAnalysisReq,
  IUtmValueFilter,
  MetaPropertyType,
  Metrics,
  UtmDimension,
  UTM_DIMENSIONS,
  utmDimAlias,
  utmMetricDateAlias,
  utmMetricTotalAlias,
} from "@probe-x/shared-types/src"
import { ISqlGenerateResult, META_TYPE_TO_CH_TYPE } from "@src/api/data-analysis/type"

/**
 * 生成参数键（使用局部索引避免并发冲突）
 */
function generateParamKey(prefix: string, indexRef: { value: number }): string {
  indexRef.value += 1
  return `param_${prefix}_${indexRef.value}`
}

/**
 * 重置参数索引
 */
function resetParamIndex(indexRef: { value: number }) {
  indexRef.value = 0
}

/**
 * 强制用反引号包裹字段名
 */
function wrapFieldWithBacktick(field: string): string {
  return `\`${field.replace(/`/g, '``')}\``
}

/**
 * 时间范围最大天数上限，防止生成过多日期列导致 SQL 过大
 */
const MAX_DATE_RANGE_DAYS = 366

/**
 * 分组行数上限，防止 5 个维度组合后行数爆炸
 */
const MAX_GROUP_ROWS = 1000

/**
 * 单个维度上取值筛选的取值个数上限
 */
const MAX_UTM_FILTER_VALUES = 500

/**
 * UTM 维度 → ClickHouse 列名
 */
const UTM_DIMENSION_COLUMN: Record<UtmDimension, string> = {
  [UtmDimension.SOURCE]: '$utm_source',
  [UtmDimension.MEDIUM]: '$utm_medium',
  [UtmDimension.CAMPAIGN]: '$utm_campaign',
  [UtmDimension.TERM]: '$utm_term',
  [UtmDimension.CONTENT]: '$utm_content',
}

/**
 * 事实表：与其余分析一致都查清洗后的 final_event_log
 */
const TABLE_NAME = '`probe_x`.`final_event_log`'

/**
 * 生成时间范围内的所有日期
 */
function generateDateList(startDate: string, endDate: string): string[] {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const dates: string[] = []

  if (start > end) {
    throw new Error('开始日期不能晚于结束日期')
  }

  const rangeDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
  if (rangeDays > MAX_DATE_RANGE_DAYS) {
    throw new Error(`时间范围不能超过${MAX_DATE_RANGE_DAYS}天`)
  }

  const current = new Date(start)
  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0]
    dates.push(dateStr)
    current.setDate(current.getDate() + 1)
  }

  return dates
}

/**
 * 清理参数名中的特殊字符
 */
function sanitizeParamName(name: string): string {
  return name.replace(/[\$\-\.\s]/g, '_')
}

/**
 * 构建过滤条件子句（带参数占位符）
 */
function buildFilterClause(filters: IAttributionAnalysisFilter[], params: Record<string, any>, indexRef: { value: number }): string {
  if (filters.length === 0) return ''

  const filterClauses = filters.map(filter => {
    const { propertyName, propertyType, compareType, propertyValue } = filter
    const field = wrapFieldWithBacktick(propertyName)
    const chType = META_TYPE_TO_CH_TYPE[propertyType]
    // 属性类型非法时明确报错，否则会拼出 {p:undefined}，到 ClickHouse 那边只报语法错误
    if (!chType) {
      throw new Error(`不支持的属性类型：${propertyType}`)
    }

    switch (compareType) {
      case 'EQUAL':
        return buildEqualFilter(field, propertyName, propertyValue, propertyType, chType, params, indexRef)
      case 'NOT_EQUAL':
        return buildNotEqualFilter(field, propertyName, propertyValue, propertyType, chType, params, indexRef)
      case 'GREATER_THAN':
        return buildSingleValueFilter(field, propertyName, propertyValue, propertyType, chType, params, '>', indexRef)
      case 'GREATER_THAN_OR_EQUAL':
        return buildSingleValueFilter(field, propertyName, propertyValue, propertyType, chType, params, '>=', indexRef)
      case 'LESS_THAN':
        return buildSingleValueFilter(field, propertyName, propertyValue, propertyType, chType, params, '<', indexRef)
      case 'LESS_THAN_OR_EQUAL':
        return buildSingleValueFilter(field, propertyName, propertyValue, propertyType, chType, params, '<=', indexRef)
      case 'RANGE':
        return buildRangeFilter(field, propertyName, propertyValue as number[] | string[], propertyType, chType, params, indexRef)
      case 'CONTAINS':
        return buildContainsFilter(field, propertyName, propertyValue as string[] | string, params, indexRef)
      case 'NOT_CONTAINS':
        return buildNotContainsFilter(field, propertyName, propertyValue as string[] | string, params, indexRef)
      case 'REGEX':
        return buildRegexFilter(field, propertyName, propertyValue as string, params, indexRef)
      default:
        throw new Error(`不支持的比较类型：${compareType}`)
    }
  })

  return filterClauses.filter(Boolean).join(' AND ')
}

/**
 * 构建等于过滤条件
 */
function buildEqualFilter(
  field: string,
  propertyName: string,
  value: any,
  propertyType: MetaPropertyType,
  chType: string,
  params: Record<string, any>,
  indexRef: { value: number },
): string {
  if (Array.isArray(value)) {
    const paramKeys = value.map((item, idx) => {
      const paramKey = generateParamKey(`${propertyType}_${sanitizeParamName(propertyName)}_equal_${idx}`, indexRef)
      params[paramKey] = item
      return `{${paramKey}:${chType}}`
    })
    return `${field} IN (${paramKeys.join(', ')})`
  }

  const paramKey = generateParamKey(`${propertyType}_${sanitizeParamName(propertyName)}_equal`, indexRef)
  params[paramKey] = value
  return `${field} = {${paramKey}:${chType}}`
}

/**
 * 构建不等于过滤条件
 */
function buildNotEqualFilter(
  field: string,
  propertyName: string,
  value: any,
  propertyType: MetaPropertyType,
  chType: string,
  params: Record<string, any>,
  indexRef: { value: number },
): string {
  if (Array.isArray(value)) {
    const paramKeys = value.map((item, idx) => {
      const paramKey = generateParamKey(`${propertyType}_${sanitizeParamName(propertyName)}_not_equal_${idx}`, indexRef)
      params[paramKey] = item
      return `{${paramKey}:${chType}}`
    })
    return `${field} NOT IN (${paramKeys.join(', ')})`
  }

  const paramKey = generateParamKey(`${propertyType}_${sanitizeParamName(propertyName)}_not_equal`, indexRef)
  params[paramKey] = value
  return `${field} != {${paramKey}:${chType}}`
}

/**
 * 构建单值比较过滤条件
 */
function buildSingleValueFilter(
  field: string,
  propertyName: string,
  value: any,
  propertyType: MetaPropertyType,
  chType: string,
  params: Record<string, any>,
  operator: string,
  indexRef: { value: number },
): string {
  const operatorKey = operator.replace(/=/g, 'eq').replace(/>/g, 'gt').replace(/</g, 'lt')
  const paramKey = generateParamKey(`${propertyType}_${sanitizeParamName(propertyName)}_${operatorKey}`, indexRef)
  params[paramKey] = value
  return `${field} ${operator} {${paramKey}:${chType}}`
}

/**
 * 构建区间过滤条件
 */
function buildRangeFilter(
  field: string,
  propertyName: string,
  value: number[] | string[],
  propertyType: MetaPropertyType,
  chType: string,
  params: Record<string, any>,
  indexRef: { value: number },
): string {
  if (value.length !== 2) {
    throw new Error('区间过滤条件必须包含两个值')
  }
  const [min, max] = value

  const minParamKey = generateParamKey(`${propertyType}_${sanitizeParamName(propertyName)}_range_min`, indexRef)
  const maxParamKey = generateParamKey(`${propertyType}_${sanitizeParamName(propertyName)}_range_max`, indexRef)

  params[minParamKey] = min
  params[maxParamKey] = max

  return `${field} BETWEEN {${minParamKey}:${chType}} AND {${maxParamKey}:${chType}}`
}

/**
 * 构建包含过滤条件
 */
function buildContainsFilter(
  field: string,
  propertyName: string,
  value: string[] | string,
  params: Record<string, any>,
  indexRef: { value: number },
): string {
  const values = Array.isArray(value) ? value : [value]
  const containsClauses = values.map((item, idx) => {
    const paramKey = generateParamKey(`string_${sanitizeParamName(propertyName)}_contains_${idx}`, indexRef)
    params[paramKey] = item
    return `position(${field}, {${paramKey}:String}) > 0`
  })
  return containsClauses.join(' OR ')
}

/**
 * 构建不包含过滤条件
 */
function buildNotContainsFilter(
  field: string,
  propertyName: string,
  value: string[] | string,
  params: Record<string, any>,
  indexRef: { value: number },
): string {
  const values = Array.isArray(value) ? value : [value]
  const notContainsClauses = values.map((item, idx) => {
    const paramKey = generateParamKey(`string_${sanitizeParamName(propertyName)}_not_contains_${idx}`, indexRef)
    params[paramKey] = item
    return `position(${field}, {${paramKey}:String}) = 0`
  })
  return notContainsClauses.join(' AND ')
}

/**
 * 构建正则匹配过滤条件
 */
function buildRegexFilter(
  field: string,
  propertyName: string,
  value: string,
  params: Record<string, any>,
  indexRef: { value: number },
): string {
  const paramKey = generateParamKey(`string_${sanitizeParamName(propertyName)}_regex`, indexRef)
  params[paramKey] = value
  return `${field} REGEXP {${paramKey}:String}`
}

/**
 * 获取指标对应的聚合表达式
 * COUNT: 条件计数
 * USERS/SESSIONS: uniqIf 条件去重统计，注意参数顺序是 (expression, condition)
 */
function getMetricAggregationExpr(metrics: Metrics, condition: string): string {
  switch (metrics) {
    case Metrics.COUNT:
      return `SUM(CASE WHEN ${condition} THEN 1 ELSE 0 END)`
    case Metrics.USERS:
      return `uniqIf(${wrapFieldWithBacktick('$uid')}, ${condition})`
    case Metrics.SESSIONS:
      return `uniqIf(${wrapFieldWithBacktick('$session_id')}, ${condition})`
    default:
      throw new Error(`不支持的指标类型：${metrics}`)
  }
}

/**
 * 区间合计的聚合表达式（不限定日期）
 *
 * 用户数/会话数是 uniq 口径，必须在整段区间上单独算一次，
 * 不能用按天列相加代替 —— 同一个用户跨天会被重复计数
 */
function getMetricTotalExpr(metrics: Metrics): string {
  switch (metrics) {
    case Metrics.COUNT:
      return 'count(*)'
    case Metrics.USERS:
      return `uniqIf(${wrapFieldWithBacktick('$uid')}, 1=1)`
    case Metrics.SESSIONS:
      return `uniqIf(${wrapFieldWithBacktick('$session_id')}, 1=1)`
    default:
      throw new Error(`不支持的指标类型：${metrics}`)
  }
}

/**
 * 构建取值列表的 IN 子句，取值一律走占位符绑定
 */
function buildInClause(
  field: string,
  values: string[],
  prefix: string,
  params: Record<string, any>,
  indexRef: { value: number },
): string {
  const paramKeys = values.map((item, idx) => {
    const paramKey = generateParamKey(`${prefix}_${idx}`, indexRef)
    params[paramKey] = item
    return `{${paramKey}:String}`
  })
  return `${field} IN (${paramKeys.join(', ')})`
}

/**
 * 构建取值列表的 NOT IN 子句
 */
function buildNotInClause(
  field: string,
  values: string[],
  prefix: string,
  params: Record<string, any>,
  indexRef: { value: number },
): string {
  const paramKeys = values.map((item, idx) => {
    const paramKey = generateParamKey(`${prefix}_${idx}`, indexRef)
    params[paramKey] = item
    return `{${paramKey}:String}`
  })
  return `${field} NOT IN (${paramKeys.join(', ')})`
}

/**
 * 校验并归一化分组维度：去重、保序、剔除非法值
 */
function normalizeDimensions(dimensions: UtmDimension[]): UtmDimension[] {
  if (!Array.isArray(dimensions) || dimensions.length === 0) {
    throw new Error('请至少选择一个 UTM 分组维度')
  }

  const result = UTM_DIMENSIONS.filter(dimension => dimensions.includes(dimension))
  if (!result.length) {
    throw new Error('UTM 分组维度取值非法')
  }
  return result
}

/**
 * 校验并归一化指标：去重、保序、剔除非法值
 */
function normalizeMetrics(metrics: Metrics[]): Metrics[] {
  if (!Array.isArray(metrics) || metrics.length === 0) {
    throw new Error('请至少选择一个数据指标')
  }

  const all = [Metrics.COUNT, Metrics.USERS, Metrics.SESSIONS]
  const result = all.filter(metric => metrics.includes(metric))
  if (!result.length) {
    throw new Error('数据指标取值非法')
  }
  return result
}

/**
 * 构建 WHERE 子句
 *
 * 分组查询与合计查询共用这一份，避免两边过滤口径漂移：
 * 1. 时间窗
 * 2. 选中的分组维度排除空取值（与 UTM 统计的 dim.2 != '' 一致）
 * 3. 软删取值整体排除：UTM 管理里删掉的取值在任何维度上都不再计入，
 *    所以 5 个维度都拼 NOT IN，不只是正在分组的那几个
 * 4. UTM 取值筛选
 * 5. 全局筛选
 */
function buildWhereClause(
  params: IUtmAnalysisReq,
  dimensions: UtmDimension[],
  ignored: Partial<Record<UtmDimension, string[]>>,
  sqlParams: Record<string, any>,
  indexRef: { value: number },
): string {
  const clauses: string[] = []

  // 1. 时间窗
  const [startDate, endDate] = params.timeRange
  const startParamKey = generateParamKey('time_start', indexRef)
  const endParamKey = generateParamKey('time_end', indexRef)
  sqlParams[startParamKey] = `${startDate} 00:00:00.000`
  sqlParams[endParamKey] = `${endDate} 23:59:59.999`
  clauses.push(
    `${wrapFieldWithBacktick('$service_time')} BETWEEN toDateTime64({${startParamKey}:String}, 3) AND toDateTime64({${endParamKey}:String}, 3)`,
  )

  // 2. 分组维度排除空取值
  dimensions.forEach(dimension => {
    clauses.push(`${wrapFieldWithBacktick(UTM_DIMENSION_COLUMN[dimension])} != ''`)
  })

  // 3. 软删取值整体排除
  UTM_DIMENSIONS.forEach(dimension => {
    const values = (ignored[dimension] || []).filter(item => typeof item === 'string' && item !== '')
    if (!values.length) return
    clauses.push(
      buildNotInClause(
        wrapFieldWithBacktick(UTM_DIMENSION_COLUMN[dimension]),
        values,
        `utm_ignored_${sanitizeParamName(dimension)}`,
        sqlParams,
        indexRef,
      ),
    )
  })

  // 4. UTM 取值筛选
  const utmFilters = (params.utmFilters || []).filter(
    (filter): filter is IUtmValueFilter =>
      !!filter && UTM_DIMENSIONS.includes(filter.dimension) && Array.isArray(filter.values) && filter.values.length > 0,
  )
  utmFilters.forEach(filter => {
    const values = filter.values.filter(item => typeof item === 'string' && item !== '')
    if (!values.length) return
    if (values.length > MAX_UTM_FILTER_VALUES) {
      throw new Error(`单个维度的取值筛选不能超过${MAX_UTM_FILTER_VALUES}个`)
    }
    clauses.push(
      buildInClause(
        wrapFieldWithBacktick(UTM_DIMENSION_COLUMN[filter.dimension]),
        values,
        `utm_filter_${sanitizeParamName(filter.dimension)}`,
        sqlParams,
        indexRef,
      ),
    )
  })

  // 5. 全局筛选
  const globalWhereClause = buildFilterClause(params.globalFilters || [], sqlParams, indexRef)
  if (globalWhereClause) {
    clauses.push(globalWhereClause)
  }

  return `WHERE ${clauses.join(' AND ')}`
}

/**
 * 构建指标列：每个指标一个区间合计列 + 每个日期一个按天列
 */
function buildMetricColumns(
  metrics: Metrics[],
  dateList: string[],
  sqlParams: Record<string, any>,
  indexRef: { value: number },
): string[] {
  const columns: string[] = []

  metrics.forEach(metric => {
    columns.push(`${getMetricTotalExpr(metric)} AS ${utmMetricTotalAlias(metric)}`)

    dateList.forEach(date => {
      const dateParamKey = generateParamKey(`metric_date_${metric}_${date.replace(/-/g, '')}`, indexRef)
      sqlParams[dateParamKey] = date
      const dateCondition = `toDate(${wrapFieldWithBacktick('$service_time')}) = toDate({${dateParamKey}:String})`
      columns.push(`${getMetricAggregationExpr(metric, dateCondition)} AS ${utmMetricDateAlias(metric, date)}`)
    })
  })

  return columns
}

/**
 * 生成 UTM 分析 SQL（分组查询）
 *
 * 按选定的 UTM 维度组合 GROUP BY，输出每个组合的区间合计与按天指标。
 * @returns SQL 生成结果，包含 SQL 语句、参数和错误信息
 */
export function generateUtmAnalysisSql(
  params: IUtmAnalysisReq,
  ignored: Partial<Record<UtmDimension, string[]>> = {},
): ISqlGenerateResult {
  const indexRef = { value: 0 }
  resetParamIndex(indexRef)
  const sqlParams: Record<string, any> = {}

  try {
    const dimensions = normalizeDimensions(params.dimensions)
    const metrics = normalizeMetrics(params.metrics)

    if (!params.timeRange || params.timeRange.length !== 2) {
      return { sql: '', params: {}, error: '时间范围格式错误' }
    }
    const dateList = generateDateList(params.timeRange[0], params.timeRange[1])

    // 分组列：维度取值本身，别名走 dim_{dimension}
    const dimensionColumns = dimensions.map(dimension =>
      `${wrapFieldWithBacktick(UTM_DIMENSION_COLUMN[dimension])} AS ${utmDimAlias(dimension)}`,
    )

    const selectParts = [
      ...dimensionColumns,
      ...buildMetricColumns(metrics, dateList, sqlParams, indexRef),
    ]

    const whereClause = buildWhereClause(params, dimensions, ignored, sqlParams, indexRef)

    // GROUP BY 用原始字段表达式，与 SELECT 里的别名对应同一列
    const groupByClause = `GROUP BY ${dimensions.map(dimension => wrapFieldWithBacktick(UTM_DIMENSION_COLUMN[dimension])).join(', ')}`

    // 按第一个选中指标的区间合计降序，投放量大的组合排前面
    const orderByClause = `ORDER BY ${utmMetricTotalAlias(metrics[0])} DESC`

    const sql = `SELECT ${selectParts.join(', ')}
                 FROM ${TABLE_NAME} ${whereClause} ${groupByClause} ${orderByClause} LIMIT ${MAX_GROUP_ROWS}`

    return { sql, params: sqlParams }
  } catch (error) {
    return { sql: '', params: {}, error: (error as Error).message }
  }
}

/**
 * 生成 UTM 分析合计 SQL（不分组）
 *
 * 同一套 WHERE，只出区间合计与按天列，返回单行。
 * 汇总表的「合计」行与趋势图的合计线都用它，保证 uniq 口径正确。
 */
export function generateUtmSummarySql(
  params: IUtmAnalysisReq,
  ignored: Partial<Record<UtmDimension, string[]>> = {},
): ISqlGenerateResult {
  const indexRef = { value: 0 }
  resetParamIndex(indexRef)
  const sqlParams: Record<string, any> = {}

  try {
    const dimensions = normalizeDimensions(params.dimensions)
    const metrics = normalizeMetrics(params.metrics)

    if (!params.timeRange || params.timeRange.length !== 2) {
      return { sql: '', params: {}, error: '时间范围格式错误' }
    }
    const dateList = generateDateList(params.timeRange[0], params.timeRange[1])

    const selectParts = buildMetricColumns(metrics, dateList, sqlParams, indexRef)
    const whereClause = buildWhereClause(params, dimensions, ignored, sqlParams, indexRef)

    const sql = `SELECT ${selectParts.join(', ')}
                 FROM ${TABLE_NAME} ${whereClause}`

    return { sql, params: sqlParams }
  } catch (error) {
    return { sql: '', params: {}, error: (error as Error).message }
  }
}
