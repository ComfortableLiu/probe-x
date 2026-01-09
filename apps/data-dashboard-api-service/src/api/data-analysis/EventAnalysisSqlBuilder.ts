import {
  IAttributionAnalysisFilter,
  IEventAnalysisInfo,
  IEventAnalysisReq,
  MetaPropertyType,
  Metrics,
} from "@probe-x/shared-types/src"
import { ISqlGenerateResult, META_TYPE_TO_CH_TYPE } from "@src/api/data-analysis/type"

/**
 * 生成唯一占位符名称
 */
let paramIndex = 0

function generateParamKey(prefix: string): string {
  paramIndex += 1
  return `param_${prefix}_${paramIndex}`
}

/**
 * 重置占位符索引
 */
function resetParamIndex() {
  paramIndex = 0
}

/**
 * 强制用反引号包裹字段名
 */
function wrapFieldWithBacktick(field: string): string {
  return `\`${field.replace(/`/g, '``')}\``
}

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
function buildFilterClause(filters: IAttributionAnalysisFilter[], params: Record<string, any>): string {
  if (filters.length === 0) return ''

  const filterClauses = filters.map(filter => {
    const { propertyName, propertyType, compareType, propertyValue } = filter
    const field = wrapFieldWithBacktick(propertyName)
    const chType = META_TYPE_TO_CH_TYPE[propertyType]

    switch (compareType) {
      case 'EQUAL':
        return buildEqualFilter(field, propertyName, propertyValue, propertyType, chType, params)
      case 'NOT_EQUAL':
        return buildNotEqualFilter(field, propertyName, propertyValue, propertyType, chType, params)
      case 'GREATER_THAN':
        return buildSingleValueFilter(field, propertyName, propertyValue, propertyType, chType, params, '>')
      case 'GREATER_THAN_OR_EQUAL':
        return buildSingleValueFilter(field, propertyName, propertyValue, propertyType, chType, params, '>=')
      case 'LESS_THAN':
        return buildSingleValueFilter(field, propertyName, propertyValue, propertyType, chType, params, '<')
      case 'LESS_THAN_OR_EQUAL':
        return buildSingleValueFilter(field, propertyName, propertyValue, propertyType, chType, params, '<=')
      case 'RANGE':
        return buildRangeFilter(field, propertyName, propertyValue as number[] | string[], propertyType, chType, params)
      case 'CONTAINS':
        return buildContainsFilter(field, propertyName, propertyValue as string[] | string, params)
      case 'NOT_CONTAINS':
        return buildNotContainsFilter(field, propertyName, propertyValue as string[] | string, params)
      case 'REGEX':
        return buildRegexFilter(field, propertyName, propertyValue as string, params)
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
): string {
  if (Array.isArray(value)) {
    const paramKeys = value.map((item, idx) => {
      const paramKey = generateParamKey(`${propertyType}_${sanitizeParamName(propertyName)}_equal_${idx}`)
      params[paramKey] = item
      return `{${paramKey}:${chType}}`
    })
    return `${field} IN (${paramKeys.join(', ')})`
  }

  const paramKey = generateParamKey(`${propertyType}_${sanitizeParamName(propertyName)}_equal`)
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
): string {
  if (Array.isArray(value)) {
    const paramKeys = value.map((item, idx) => {
      const paramKey = generateParamKey(`${propertyType}_${sanitizeParamName(propertyName)}_not_equal_${idx}`)
      params[paramKey] = item
      return `{${paramKey}:${chType}}`
    })
    return `${field} NOT IN (${paramKeys.join(', ')})`
  }

  const paramKey = generateParamKey(`${propertyType}_${sanitizeParamName(propertyName)}_not_equal`)
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
): string {
  const operatorKey = operator.replace(/=/g, 'eq').replace(/>/g, 'gt').replace(/</g, 'lt')
  const paramKey = generateParamKey(`${propertyType}_${sanitizeParamName(propertyName)}_${operatorKey}`)
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
): string {
  if (value.length !== 2) {
    throw new Error('区间过滤条件必须包含两个值')
  }
  const [min, max] = value

  const minParamKey = generateParamKey(`${propertyType}_${sanitizeParamName(propertyName)}_range_min`)
  const maxParamKey = generateParamKey(`${propertyType}_${sanitizeParamName(propertyName)}_range_max`)

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
): string {
  const values = Array.isArray(value) ? value : [value]
  const containsClauses = values.map((item, idx) => {
    const paramKey = generateParamKey(`string_${sanitizeParamName(propertyName)}_contains_${idx}`)
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
): string {
  const values = Array.isArray(value) ? value : [value]
  const notContainsClauses = values.map((item, idx) => {
    const paramKey = generateParamKey(`string_${sanitizeParamName(propertyName)}_not_contains_${idx}`)
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
): string {
  const paramKey = generateParamKey(`string_${sanitizeParamName(propertyName)}_regex`)
  params[paramKey] = value
  return `${field} REGEXP {${paramKey}:String}`
}

/**
 * 获取指标对应的聚合表达式
 * COUNT: 使用SUM计数
 * USERS/SESSIONS: 使用uniqIf进行条件去重统计（ClickHouse内置函数）
 */
function getMetricAggregationExpr(metrics: Metrics, condition: string): string {
  switch (metrics) {
    case Metrics.COUNT:
      return `SUM(CASE WHEN ${condition} THEN 1 ELSE 0 END)`
    case Metrics.USERS:
      return `uniqIf(${condition}, ${wrapFieldWithBacktick('$uid')})`
    case Metrics.SESSIONS:
      return `uniqIf(${condition}, ${wrapFieldWithBacktick('$session_id')})`
    default:
      throw new Error(`不支持的指标类型：${metrics}`)
  }
}

/**
 * 生成事件别名
 */
function getEventAlias(eventInfo: IEventAnalysisInfo, index: number): string {
  const eventName = eventInfo.eventName || 'unknown'
  return `event_${index}_${eventName.replace(/\W+/g, '_')}`
}

/**
 * 生成事件-日期组合别名
 */
function getEventDateAlias(eventInfo: IEventAnalysisInfo, date: string, index: number): string {
  const eventAlias = getEventAlias(eventInfo, index)
  const dateStr = date.replace(/-/g, '_')
  return `${eventAlias}_${dateStr}`
}

/**
 * 生成事件分析SQL
 * 功能：按事件和日期维度统计各事件的指标数据（支持COUNT/USERS/SESSIONS）
 * @param params 事件分析请求参数
 * @returns SQL生成结果，包含SQL语句、参数和错误信息
 */
export function generateEventAnalysisSql(params: IEventAnalysisReq): ISqlGenerateResult {
  resetParamIndex()
  const sqlParams: Record<string, any> = {}

  try {
    // 基础参数校验
    if (!params.eventInfoList || params.eventInfoList.length === 0) {
      return { sql: '', params: {}, error: '事件列表不能为空' }
    }
    if (!params.timeRange || params.timeRange.length !== 2) {
      return { sql: '', params: {}, error: '时间范围格式错误' }
    }

    const [startDate, endDate] = params.timeRange
    const dateList = generateDateList(startDate, endDate)

    // 1. 处理时间范围过滤（参数化）
    const startParamKey = generateParamKey('time_start')
    const endParamKey = generateParamKey('time_end')
    sqlParams[startParamKey] = `${startDate} 00:00:00.000`
    sqlParams[endParamKey] = `${endDate} 23:59:59.999`
    const timeFilter = `${wrapFieldWithBacktick('$service_time')} BETWEEN toDateTime64({${startParamKey}:String}, 3) AND toDateTime64({${endParamKey}:String}, 3)`

    // 2. 全局过滤条件
    const globalWhereClause = buildFilterClause(params.globalFilters || [], sqlParams)
    const whereClauses = [timeFilter, globalWhereClause].filter(Boolean)
    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''

    // 3. 维度字段处理（去重 + 反引号包裹）
    const dimensionFields = [...new Set(params.dimension)].map(field => wrapFieldWithBacktick(field))
    const groupByClause = dimensionFields.length > 0 ? `GROUP BY ${dimensionFields.join(', ')}` : ''

    // 4. 按维度顺序生成ORDER BY子句
    // 排序规则：按维度数组顺序升序排序，用于适配前端表格合并展示
    const orderByClause = dimensionFields.length > 0
      ? `ORDER BY ${dimensionFields.join(', ')} ASC`
      : ''

    // 5. 生成事件指标SQL片段
    // 使用统一的聚合表达式生成函数，支持COUNT/USERS/SESSIONS
    const eventMetricFragments = params.eventInfoList.map((eventInfo, index) => {
      const { eventName, filters = [], metrics } = eventInfo
      const eventAlias = getEventAlias(eventInfo, index)
      const eventNameParamKey = generateParamKey(`event_name_${index}`)

      // 构建事件专属过滤条件
      const eventFilterClause = buildFilterClause(filters, sqlParams)
      let eventCondition = '1=1'

      // 事件名条件
      if (eventName) {
        sqlParams[eventNameParamKey] = eventName
        eventCondition = `${wrapFieldWithBacktick('$event_name')} = {${eventNameParamKey}:String}`
      }

      // 组合事件条件
      if (eventFilterClause) {
        eventCondition = `${eventCondition} AND ${eventFilterClause}`
      }

      // 按日期生成指标列：为每个日期生成一个聚合列
      const dateMetrics = dateList.map(date => {
        const dateParamKey = generateParamKey(`event_date_${index}_${date.replace(/-/g, '')}`)
        sqlParams[dateParamKey] = date

        const dateCondition = `toDate(${wrapFieldWithBacktick('$service_time')}) = toDate({${dateParamKey}:String})`
        const fullCondition = `${eventCondition} AND ${dateCondition}`

        // 使用统一的聚合表达式生成函数
        const aggregationExpr = getMetricAggregationExpr(metrics, fullCondition)
        return `${aggregationExpr} AS ${getEventDateAlias(eventInfo, date, index)}`
      }).join(', ')

      // 事件名列（参数化）
      const eventAliasParamKey = generateParamKey(`event_alias_${index}`)
      sqlParams[eventAliasParamKey] = eventName || 'unknown_event'
      const eventNameColumn = `{${eventAliasParamKey}:String} AS ${eventAlias}`

      return {
        eventNameColumn,
        dateMetrics,
      }
    })

    // 6. 拼接SELECT子句
    const selectParts = [
      ...dimensionFields,
      ...eventMetricFragments.flatMap(frag => [frag.eventNameColumn, frag.dateMetrics]),
    ].filter(Boolean)

    const selectClause = selectParts.join(', ')

    // 7. 构建最终SQL
    const tableName = '`probe_x`.`final_event_log`'
    const sql = `SELECT ${selectClause}
                 FROM ${tableName} ${whereClause} ${groupByClause} ${orderByClause}`

    return { sql, params: sqlParams }
  } catch (error) {
    return { sql: '', params: {}, error: (error as Error).message }
  }
}
