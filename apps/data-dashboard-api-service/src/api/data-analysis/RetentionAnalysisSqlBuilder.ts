import {
  IAttributionAnalysisFilter,
  IRetentionAnalysisReq,
  MetaPropertyType,
  RetentionGranularity,
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
 * 获取粒度对应的日期截断函数
 */
function getGranularityTruncateExpr(granularity: RetentionGranularity, fieldExpr: string): string {
  switch (granularity) {
    case RetentionGranularity.DAY:
      return `toDate(${fieldExpr})`
    case RetentionGranularity.WEEK:
      return `toMonday(${fieldExpr})`
    case RetentionGranularity.MONTH:
      return `toStartOfMonth(${fieldExpr})`
    default:
      return `toDate(${fieldExpr})`
  }
}

/**
 * 生成留存分析SQL
 * 功能：计算用户在指定时间窗口内的留存率
 *
 * 实现思路：
 * 1. cohort_users: 找出每个队列周期内触发起始事件的用户
 * 2. return_events: 找出所有触发回访事件的记录
 * 3. 留存计算: 对每个队列，检查用户在各个留存窗口内是否有回访事件
 *
 * @param params 留存分析请求参数
 * @returns SQL生成结果
 */
export function generateRetentionAnalysisSql(params: IRetentionAnalysisReq): ISqlGenerateResult {
  const indexRef = { value: 0 }
  resetParamIndex(indexRef)
  const sqlParams: Record<string, any> = {}

  try {
    // 基础参数校验
    if (!params.startEvent?.eventName) {
      return { sql: '', params: {}, error: '起始事件名称不能为空' }
    }
    if (!params.returnEvent?.eventName) {
      return { sql: '', params: {}, error: '回访事件名称不能为空' }
    }
    if (!params.timeRange || params.timeRange.length !== 2) {
      return { sql: '', params: {}, error: '时间范围格式错误' }
    }
    if (!params.retentionWindows || params.retentionWindows.length === 0) {
      return { sql: '', params: {}, error: '留存窗口不能为空' }
    }

    const [startDate, endDate] = params.timeRange
    const { granularity = RetentionGranularity.DAY, dimension = [], globalFilters = [] } = params

    // 时间范围过滤
    const startParamKey = generateParamKey('time_start', indexRef)
    const endParamKey = generateParamKey('time_end', indexRef)
    sqlParams[startParamKey] = `${startDate} 00:00:00.000`
    sqlParams[endParamKey] = `${endDate} 23:59:59.999`
    const timeFilter = `${wrapFieldWithBacktick('$service_time')} BETWEEN toDateTime64({${startParamKey}:String}, 3) AND toDateTime64({${endParamKey}:String}, 3)`

    // 全局过滤条件
    const globalWhereClause = buildFilterClause(globalFilters, sqlParams, indexRef)

    // 维度字段处理
    const dimensionFields = [...new Set(dimension)]
      .filter(field => field && typeof field === 'string' && field.trim() !== '')
      .map(field => wrapFieldWithBacktick(field))

    // 起始事件条件
    const startEventNameParamKey = generateParamKey('start_event_name', indexRef)
    sqlParams[startEventNameParamKey] = params.startEvent.eventName
    let startEventCondition = `${wrapFieldWithBacktick('$event_name')} = {${startEventNameParamKey}:String}`
    if (params.startEvent.filters && params.startEvent.filters.length > 0) {
      const startFilterClause = buildFilterClause(params.startEvent.filters, sqlParams, indexRef)
      if (startFilterClause) {
        startEventCondition = `${startEventCondition} AND ${startFilterClause}`
      }
    }

    // 回访事件条件
    const returnEventNameParamKey = generateParamKey('return_event_name', indexRef)
    sqlParams[returnEventNameParamKey] = params.returnEvent.eventName
    let returnEventCondition = `${wrapFieldWithBacktick('$event_name')} = {${returnEventNameParamKey}:String}`
    if (params.returnEvent.filters && params.returnEvent.filters.length > 0) {
      const returnFilterClause = buildFilterClause(params.returnEvent.filters, sqlParams, indexRef)
      if (returnFilterClause) {
        returnEventCondition = `${returnEventCondition} AND ${returnFilterClause}`
      }
    }

    // 队列日期表达式
    const cohortDateExpr = getGranularityTruncateExpr(granularity, wrapFieldWithBacktick('$service_time'))

    // 扩展时间范围以覆盖留存窗口（需要查看窗口天数后的数据）
    const maxWindow = Math.max(...params.retentionWindows)
    const extendedEndParamKey = generateParamKey('extended_end', indexRef)
    sqlParams[extendedEndParamKey] = `${endDate} 23:59:59.999`

    // 生成留存窗口的天数参数
    const windowParamKeys = params.retentionWindows.map(day => {
      const paramKey = generateParamKey(`window_${day}d`, indexRef)
      sqlParams[paramKey] = day
      return { day, paramKey }
    })

    // 构建维度字段的SELECT和GROUP BY
    const dimensionSelect = dimensionFields.length > 0
      ? dimensionFields.map(f => `cohort_users.${f}`).join(', ') + ', '
      : ''
    const dimensionGroupBy = dimensionFields.length > 0
      ? `GROUP BY cohort_date, ${dimensionFields.map(f => `cohort_users.${f}`).join(', ')}`
      : 'GROUP BY cohort_date'
    const dimensionJoin = dimensionFields.length > 0
      ? `AND ${dimensionFields.map(f => `cohort_users.${f} = return_events.${f}`).join(' AND ')}`
      : ''

    // 构建留存窗口的CASE WHEN表达式
    const retentionWindowCases = windowParamKeys.map(({ day, paramKey }) => {
      return `
        ROUND(
          COUNT(DISTINCT CASE
            WHEN return_events.first_return_date <= cohort_users.cohort_date + INTERVAL {${paramKey}:Int64} DAY
            THEN cohort_users.${wrapFieldWithBacktick('$uid')}
            ELSE NULL
          END) * 100.0 / NULLIF(COUNT(DISTINCT cohort_users.${wrapFieldWithBacktick('$uid')}), 0),
          2
        ) AS ${wrapFieldWithBacktick(`retention_rate_${day}d`)},
        COUNT(DISTINCT CASE
          WHEN return_events.first_return_date <= cohort_users.cohort_date + INTERVAL {${paramKey}:Int64} DAY
          THEN cohort_users.${wrapFieldWithBacktick('$uid')}
          ELSE NULL
        END) AS ${wrapFieldWithBacktick(`retention_users_${day}d`)}`
    }).join(',\n')

    // 构建最终SQL
    const tableName = '`probe_x`.`final_event_log`'
    const sql = `WITH
-- 1. 找出每个队列周期内触发起始事件的用户
cohort_users AS (
  SELECT
    ${cohortDateExpr} AS cohort_date,
    ${wrapFieldWithBacktick('$uid')}${dimensionFields.length > 0 ? ',\n    ' + dimensionFields.join(',\n    ') : ''}
  FROM ${tableName}
  WHERE ${timeFilter}
    AND ${startEventCondition}
    ${globalWhereClause ? `AND ${globalWhereClause}` : ''}
  GROUP BY cohort_date, ${wrapFieldWithBacktick('$uid')}${dimensionFields.length > 0 ? ', ' + dimensionFields.join(', ') : ''}
),

-- 2. 找出所有触发回访事件的用户及其首次回访日期
return_events AS (
  SELECT
    ${wrapFieldWithBacktick('$uid')},
    MIN(${cohortDateExpr}) AS first_return_date${dimensionFields.length > 0 ? ',\n    ' + dimensionFields.join(',\n    ') : ''}
  FROM ${tableName}
  WHERE ${wrapFieldWithBacktick('$service_time')} BETWEEN toDateTime64({${startParamKey}:String}, 3) AND date_add(DAY, ${maxWindow}, toDateTime64({${extendedEndParamKey}:String}, 3))
    AND ${returnEventCondition}
    ${globalWhereClause ? `AND ${globalWhereClause}` : ''}
  GROUP BY ${wrapFieldWithBacktick('$uid')}${dimensionFields.length > 0 ? ', ' + dimensionFields.join(', ') : ''}
),

-- 3. 计算留存数据
retention_data AS (
  SELECT
    cohort_users.cohort_date,
    COUNT(DISTINCT cohort_users.${wrapFieldWithBacktick('$uid')}) AS cohort_size,
    ${retentionWindowCases}
  FROM cohort_users
  LEFT JOIN return_events
    ON cohort_users.${wrapFieldWithBacktick('$uid')} = return_events.${wrapFieldWithBacktick('$uid')}
    ${dimensionJoin}
  ${dimensionGroupBy}
)

SELECT
  cohort_date,
  cohort_size${params.retentionWindows.map(day => `,\n  ${wrapFieldWithBacktick(`retention_rate_${day}d`)},\n  ${wrapFieldWithBacktick(`retention_users_${day}d`)}`).join('')}
FROM retention_data
ORDER BY cohort_date ASC`

    return { sql, params: sqlParams }
  } catch (error) {
    return { sql: '', params: {}, error: (error as Error).message }
  }
}
