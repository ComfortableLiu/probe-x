import {
  AggregatorCompareType,
  BehaviorAggregator,
  ConditionLogic,
  IBehaviorCondition,
  IConditionGroup,
  ISegmentCreateReq,
  IPropertyCondition,
  SegmentConditionType,
  TimeWindowUnit,
} from "@probe-x/shared-types/src"
import { IAttributionAnalysisFilter, MetaPropertyType } from "@probe-x/shared-types/src"
import { ISqlGenerateResult, META_TYPE_TO_CH_TYPE } from "@src/api/data-analysis/type"

/**
 * 生成参数键（使用局部索引避免并发冲突）
 */
function generateParamKey(prefix: string, indexRef: { value: number }): string {
  indexRef.value += 1
  return `param_${prefix}_${indexRef.value}`
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
 * 构建属性过滤条件
 */
function buildPropertyFilter(
  filter: IAttributionAnalysisFilter,
  params: Record<string, any>,
  indexRef: { value: number },
): string {
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
 * 构建行为条件SQL
 * 返回一个子查询，用于获取满足行为条件的用户ID列表
 */
function buildBehaviorConditionSQL(
  condition: IBehaviorCondition,
  params: Record<string, any>,
  indexRef: { value: number },
  timeRange: [string, string],
): string {
  const [startDate, endDate] = timeRange
  const tableName = '`probe_x`.`final_event_log`'

  // 事件名称参数
  const eventNameParamKey = generateParamKey('behavior_event_name', indexRef)
  params[eventNameParamKey] = condition.eventName

  // 时间范围参数
  const startParamKey = generateParamKey('behavior_time_start', indexRef)
  const endParamKey = generateParamKey('behavior_time_end', indexRef)
  params[startParamKey] = `${startDate} 00:00:00.000`
  params[endParamKey] = `${endDate} 23:59:59.999`

  // 时间窗口参数
  const timeWindowParamKey = generateParamKey('behavior_time_window', indexRef)
  params[timeWindowParamKey] = condition.timeWindowDays

  // 基础条件
  let eventCondition = `${wrapFieldWithBacktick('$event_name')} = {${eventNameParamKey}:String}`

  // 事件过滤条件
  if (condition.filters && condition.filters.length > 0) {
    const filterClauses = condition.filters.map(filter =>
      buildPropertyFilter(filter, params, indexRef),
    ).filter(Boolean)
    if (filterClauses.length > 0) {
      eventCondition += ` AND ${filterClauses.join(' AND ')}`
    }
  }

  // 时间条件
  const timeCondition = `${wrapFieldWithBacktick('$service_time')} BETWEEN date_sub(DAY, {${timeWindowParamKey}:Int64}, toDateTime64({${endParamKey}:String}, 3)) AND toDateTime64({${endParamKey}:String}, 3)`

  // 根据聚合类型构建SQL
  switch (condition.aggregator) {
    case BehaviorAggregator.DID:
      // 触发过事件的用户
      return `SELECT DISTINCT ${wrapFieldWithBacktick('$uid')} AS user_id
        FROM ${tableName}
        WHERE ${eventCondition} AND ${timeCondition}`

    case BehaviorAggregator.DID_NOT:
      // 未触发过事件的用户
      return `SELECT DISTINCT ${wrapFieldWithBacktick('$uid')} AS user_id
        FROM ${tableName}
        WHERE ${wrapFieldWithBacktick('$service_time')} BETWEEN toDateTime64({${startParamKey}:String}, 3) AND toDateTime64({${endParamKey}:String}, 3)
        AND ${wrapFieldWithBacktick('$uid')} NOT IN (
          SELECT DISTINCT ${wrapFieldWithBacktick('$uid')}
          FROM ${tableName}
          WHERE ${eventCondition} AND ${timeCondition}
        )`

    case BehaviorAggregator.COUNT:
      // 触发次数满足条件的用户
      if (!condition.compareType || condition.compareValue === undefined) {
        throw new Error('COUNT 聚合类型需要指定 compareType 和 compareValue')
      }

      const countParamKey = generateParamKey('behavior_count_value', indexRef)
      params[countParamKey] = condition.compareValue

      const operator = getAggregatorOperator(condition.compareType)

      return `SELECT ${wrapFieldWithBacktick('$uid')} AS user_id
        FROM ${tableName}
        WHERE ${eventCondition} AND ${timeCondition}
        GROUP BY ${wrapFieldWithBacktick('$uid')}
        HAVING COUNT(*) ${operator} {${countParamKey}:Int64}`

    default:
      throw new Error(`不支持的聚合类型：${condition.aggregator}`)
  }
}

/**
 * 获取聚合比较操作符
 */
function getAggregatorOperator(compareType: AggregatorCompareType): string {
  switch (compareType) {
    case AggregatorCompareType.GT:
      return '>'
    case AggregatorCompareType.GTE:
      return '>='
    case AggregatorCompareType.LT:
      return '<'
    case AggregatorCompareType.LTE:
      return '<='
    case AggregatorCompareType.EQ:
      return '='
    default:
      throw new Error(`不支持的比较类型：${compareType}`)
  }
}

/**
 * 构建属性条件SQL
 * 返回一个WHERE子句片段
 */
function buildPropertyConditionSQL(
  condition: IPropertyCondition,
  params: Record<string, any>,
  indexRef: { value: number },
): string {
  return buildPropertyFilter(condition.filter, params, indexRef)
}

/**
 * 构建条件组SQL
 * 返回一个子查询，用于获取满足条件组的用户ID列表
 */
function buildConditionGroupSQL(
  group: IConditionGroup,
  params: Record<string, any>,
  indexRef: { value: number },
  timeRange: [string, string],
): string {
  const tableName = '`probe_x`.`final_event_log`'

  // 分离行为条件和属性条件
  const behaviorConditions = group.conditions.filter(
    (c): c is IBehaviorCondition => c.type === SegmentConditionType.BEHAVIOR,
  )
  const propertyConditions = group.conditions.filter(
    (c): c is IPropertyCondition => c.type === SegmentConditionType.PROPERTY,
  )

  // 如果只有属性条件，需要基于事件表查询
  if (behaviorConditions.length === 0 && propertyConditions.length > 0) {
    const propertyClauses = propertyConditions.map(c =>
      buildPropertyConditionSQL(c, params, indexRef),
    )

    const whereClause = group.logic === ConditionLogic.AND
      ? propertyClauses.join(' AND ')
      : propertyClauses.join(' OR ')

    return `SELECT DISTINCT ${wrapFieldWithBacktick('$uid')} AS user_id
      FROM ${tableName}
      WHERE ${whereClause}`
  }

  // 如果只有行为条件
  if (behaviorConditions.length > 0 && propertyConditions.length === 0) {
    const behaviorQueries = behaviorConditions.map(c =>
      buildBehaviorConditionSQL(c, params, indexRef, timeRange),
    )

    if (behaviorQueries.length === 1) {
      return behaviorQueries[0]
    }

    // 多个行为条件的组合
    if (group.logic === ConditionLogic.AND) {
      // AND：交集
      return behaviorQueries.map((q, idx) => {
        if (idx === 0) return q
        return `SELECT user_id FROM (${q}) AS t${idx} WHERE user_id IN (SELECT user_id FROM (${behaviorQueries[0]}) AS t0)`
      }).join(' INTERSECT ')
    } else {
      // OR：并集
      return behaviorQueries.join(' UNION DISTINCT ')
    }
  }

  // 混合条件
  const allQueries: string[] = []

  // 行为条件
  behaviorConditions.forEach(c => {
    allQueries.push(buildBehaviorConditionSQL(c, params, indexRef, timeRange))
  })

  // 属性条件（需要结合事件表）
  if (propertyConditions.length > 0) {
    const propertyClauses = propertyConditions.map(c =>
      buildPropertyConditionSQL(c, params, indexRef),
    )

    const whereClause = group.logic === ConditionLogic.AND
      ? propertyClauses.join(' AND ')
      : propertyClauses.join(' OR ')

    allQueries.push(`SELECT DISTINCT ${wrapFieldWithBacktick('$uid')} AS user_id
      FROM ${tableName}
      WHERE ${whereClause}`)
  }

  if (group.logic === ConditionLogic.AND) {
    // AND：交集 - 使用 INTERSECT
    return allQueries.map((q, idx) => {
      if (idx === 0) return q
      return `SELECT user_id FROM (${q}) AS t${idx} WHERE user_id IN (SELECT user_id FROM (${allQueries[0]}) AS t0)`
    }).join(' INTERSECT ')
  } else {
    // OR：并集
    return allQueries.join(' UNION DISTINCT ')
  }
}

/**
 * 生成用户分群SQL
 *
 * @param params 分群创建请求参数
 * @returns SQL生成结果
 */
export function generateSegmentSQL(params: ISegmentCreateReq): ISqlGenerateResult {
  const indexRef = { value: 0 }
  const sqlParams: Record<string, any> = {}

  try {
    // 参数校验
    if (!params.name || params.name.trim() === '') {
      return { sql: '', params: {}, error: '分群名称不能为空' }
    }

    if (!params.conditionGroups || params.conditionGroups.length === 0) {
      return { sql: '', params: {}, error: '分群条件不能为空' }
    }

    if (!params.timeRange || params.timeRange.length !== 2) {
      return { sql: '', params: {}, error: '时间范围格式错误' }
    }

    // 构建每个条件组的子查询
    const groupQueries = params.conditionGroups.map(group =>
      buildConditionGroupSQL(group, sqlParams, indexRef, params.timeRange),
    )

    // 条件组之间是 AND 关系
    let userQuery: string

    if (groupQueries.length === 1) {
      userQuery = groupQueries[0]
    } else {
      // 多个条件组取交集
      userQuery = groupQueries.map((q, idx) => {
        if (idx === 0) return q
        return `SELECT user_id FROM (${q}) AS g${idx} WHERE user_id IN (SELECT user_id FROM (${groupQueries[0]}) AS g0)`
      }).join(' INTERSECT ')
    }

    // 最终SQL：统计用户数量并返回用户ID列表
    const sql = `SELECT
      user_id,
      count() OVER () AS total_count
    FROM (${userQuery}) AS segment_users
    ORDER BY user_id`

    return { sql, params: sqlParams }
  } catch (error) {
    return { sql: '', params: {}, error: (error as Error).message }
  }
}

/**
 * 生成分群统计SQL
 *
 * @param segmentId 分群ID（这里使用条件快照）
 * @returns SQL生成结果
 */
export function generateSegmentStatsSQL(segmentId: string): ISqlGenerateResult {
  // 分群统计通常基于已计算的结果存储
  // 这里返回一个基础的统计查询框架
  const sql = `SELECT
    count(DISTINCT user_id) AS total_users
  FROM segment_results
  WHERE segment_id = {segmentId:String}`

  return {
    sql,
    params: { segmentId },
  }
}
