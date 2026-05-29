import {
  CompareType,
  IAttributionAnalysisFilter,
  IUserPathAnalysisReq,
  MetaPropertyType,
} from "@probe-x/shared-types/src"
import { ISqlGenerateResult, META_TYPE_TO_CH_TYPE } from "@src/api/data-analysis/type"

/**
 * 生成参数键（使用局部索引避免并发冲突）
 * @param prefix 前缀
 * @param indexRef 索引引用（局部状态）
 * @returns 唯一参数键
 */
function generateParamKey(prefix: string, indexRef: { value: number }): string {
  indexRef.value += 1
  return `param_${prefix}_${indexRef.value}`
}

/**
 * 重置参数索引
 * @param indexRef 索引引用
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
 * 构建过滤条件子句（带参数占位符）
 */
function buildFilterClause(filters: IAttributionAnalysisFilter[], params: Record<string, any>, indexRef: { value: number }): string {
  if (filters.length === 0) return ''

  const filterClauses = filters.map(filter => {
    const { propertyName, propertyType, compareType, propertyValue } = filter
    const field = wrapFieldWithBacktick(propertyName)
    const chType = META_TYPE_TO_CH_TYPE[propertyType]

    switch (compareType as CompareType) {
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
 * 生成用户路径分析SQL（桑基图边表数据）
 * 核心规则：
 * 1. 相同$session_id视为同一Session，按Session分组处理事件序列
 * 2. 仅保留eventList中的事件参与流转
 * 3. 起始事件：仅保留包含该事件的Session，且截取第一个起始事件后的所有流转
 * 4. 结束事件：仅保留包含该事件的Session，且截取最后一个结束事件前的所有流转
 * 5. 同一用户+Session内的同一事件流转只统计1次
 */
export function generateUserPathAnalysisSql(params: IUserPathAnalysisReq): ISqlGenerateResult {
  // 参数索引引用，每个请求独立，确保参数名唯一
  const indexRef = { value: 0 }
  resetParamIndex(indexRef)
  const sqlParams: Record<string, any> = {}

  try {
    // 1. 基础参数校验
    if (!params.eventList || params.eventList.length === 0) {
      return { sql: '', params: {}, error: '分析事件列表不能为空' }
    }
    if (!params.timeRange || params.timeRange.length !== 2) {
      return { sql: '', params: {}, error: '时间范围格式错误（需传入["YYYY-MM-DD", "YYYY-MM-DD"]）' }
    }
    if (params.startEvent && params.endEvent) {
      return { sql: '', params: {}, error: '开始事件和结束事件不能同时指定' }
    }

    const [startDate, endDate] = params.timeRange
    const tableName = `${wrapFieldWithBacktick('probe_x')}.${wrapFieldWithBacktick('final_event_log')}`
    const eventField = wrapFieldWithBacktick('$event_name')
    const uidField = wrapFieldWithBacktick('$uid')
    const sessionIdField = wrapFieldWithBacktick('$session_id')
    const logTimeField = wrapFieldWithBacktick('$log_time')
    const serviceTimeField = wrapFieldWithBacktick('$service_time')

    // 2. 处理时间范围过滤（参数化）
    const startParamKey = generateParamKey('time_start', indexRef)
    const endParamKey = generateParamKey('time_end', indexRef)
    sqlParams[startParamKey] = `${startDate} 00:00:00.000`
    sqlParams[endParamKey] = `${endDate} 23:59:59.999`
    const timeFilter = `${serviceTimeField} BETWEEN toDateTime64({${startParamKey}:String}, 3) AND toDateTime64({${endParamKey}:String}, 3)`

    // 3. 处理事件列表过滤（参数化数组）
    const eventListParamKey = generateParamKey('event_list', indexRef)
    sqlParams[eventListParamKey] = params.eventList
    const eventFilter = `${eventField} IN ({${eventListParamKey}:Array(String)})`

    // 4. 处理全局筛选条件
    const globalWhereClause = buildFilterClause(params.globalFilters || [], sqlParams, indexRef)

    // 5. 组合基础WHERE子句（仅保留选中事件、时间范围、全局过滤）
    const whereClauses = [timeFilter, eventFilter, globalWhereClause].filter(Boolean)
    const baseWhereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''

    // 6. 处理开始/结束事件参数
    let startEventParamKey = ''
    let endEventParamKey = ''
    if (params.startEvent) {
      startEventParamKey = generateParamKey('start_event', indexRef)
      sqlParams[startEventParamKey] = params.startEvent
    }
    if (params.endEvent) {
      endEventParamKey = generateParamKey('end_event', indexRef)
      sqlParams[endEventParamKey] = params.endEvent
    }

    // 7. 构建CTE表达式（核心逻辑：基于Session的事件流转分析）
    const cteExpressions = [
      // CTE1: 筛选基础数据（仅保留核心字段，过滤未选中事件）
      `base_data AS (
        SELECT
          ${uidField} AS uid,
          ${sessionIdField} AS session_id,
          ${eventField} AS event_name,
          ${logTimeField} AS log_time
        FROM ${tableName}
        ${baseWhereClause}
        -- 排除session_id为空的无效数据
        AND ${sessionIdField} != ''
      )`,

      // CTE2: 按「用户+Session」分组排序，获取相邻事件和Session内事件标记
      `session_event_sequence AS (
        SELECT
          uid,
          session_id,
          event_name AS current_event,
          -- 获取同一Session内的上一个事件（相邻流转）
          lag(event_name) OVER (PARTITION BY uid, session_id ORDER BY log_time) AS prev_event,
          log_time,
          -- 标记当前事件是否是起始事件（如有）
          ${params.startEvent ? `CASE WHEN event_name = {${startEventParamKey}:String} THEN 1 ELSE 0 END AS is_start_event,` : ''}
          -- 标记当前事件是否是结束事件（如有）
          ${params.endEvent ? `CASE WHEN event_name = {${endEventParamKey}:String} THEN 1 ELSE 0 END AS is_end_event,` : ''}
          -- Session内是否包含起始事件（用于筛选Session）
          ${params.startEvent ? `max(CASE WHEN event_name = {${startEventParamKey}:String} THEN 1 ELSE 0 END) OVER (PARTITION BY uid, session_id) AS session_has_start_event,` : ''}
          -- Session内是否包含结束事件（用于筛选Session）
          ${params.endEvent ? `max(CASE WHEN event_name = {${endEventParamKey}:String} THEN 1 ELSE 0 END) OVER (PARTITION BY uid, session_id) AS session_has_end_event,` : ''}
          -- Session内第一个起始事件的位置（用于截取序列）
          ${params.startEvent ? `min(CASE WHEN event_name = {${startEventParamKey}:String} THEN log_time ELSE toDateTime64('9999-12-31', 3) END) OVER (PARTITION BY uid, session_id) AS first_start_event_time,` : ''}
          -- Session内最后一个结束事件的位置（用于截取序列）
          ${params.endEvent ? `max(CASE WHEN event_name = {${endEventParamKey}:String} THEN log_time ELSE toDateTime64('1970-01-01', 3) END) OVER (PARTITION BY uid, session_id) AS last_end_event_time,` : ''}
          -- 事件在Session内的排序（用于去重）
          row_number() OVER (PARTITION BY uid, session_id ORDER BY log_time) AS event_order
        FROM base_data
      )`,

      // CTE3: 筛选有效Session和事件流转（应用起始/结束事件规则）
      `valid_session_events AS (
        SELECT
          uid,
          session_id,
          prev_event AS source,
          current_event AS target,
          log_time,
          event_order
        FROM session_event_sequence
        WHERE
          -- 基础过滤：排除前一个事件为空且当前事件不是起始事件的情况（避免孤立事件）
          (prev_event IS NOT NULL OR (prev_event IS NULL AND ${params.startEvent ? 'is_start_event = 1' : '1=0'}))
          -- 当前事件必须非空
          AND current_event IS NOT NULL
          -- 源事件允许为空（起始事件作为起点），否则必须在分析列表中
          AND (source IS NULL OR source IN ({${eventListParamKey}:Array(String)}))
          -- 目标事件必须在分析列表中
          AND target IN ({${eventListParamKey}:Array(String)})
          -- 起始事件规则：仅保留包含起始事件的Session，且事件在第一个起始事件之后
          ${params.startEvent ? `AND session_has_start_event = 1 AND log_time >= first_start_event_time` : ''}
          -- 结束事件规则：仅保留包含结束事件的Session，且事件在最后一个结束事件之前
          ${params.endEvent ? `AND session_has_end_event = 1 AND log_time <= last_end_event_time` : ''}
      )`,

      // CTE4: 按「用户+Session+事件对」去重（同一Session内同一流转只统计1次）
      // 使用ROW_NUMBER窗口函数实现去重（ClickHouse不支持DISTINCT ON语法）
      `distinct_session_pairs AS (
        SELECT
          source,
          target
        FROM (
          SELECT
            source,
            target,
            ROW_NUMBER() OVER (PARTITION BY uid, session_id, source, target ORDER BY event_order) AS rn
          FROM valid_session_events
        )
        WHERE rn = 1
      )`,
    ]

    // 8. 最终查询：同时返回eventList和edgeList
    // eventList: 从base_data中提取所有唯一的事件名
    // edgeList: 统计事件对流转次数（跨所有用户+Session的总次数）
    // 注意：ClickHouse返回edgeList为数组格式，service需要转换为对象数组
    const finalQuery = `
      WITH ${cteExpressions.filter(Boolean).join(', ')},
      edge_data AS (
        SELECT
          source,
          target,
          COUNT(*) AS value
        FROM distinct_session_pairs
        GROUP BY source, target
        ORDER BY value DESC
      ),
      event_data AS (
        SELECT DISTINCT event_name AS event
        FROM base_data
        WHERE event_name IS NOT NULL AND event_name != ''
        ORDER BY event
      )
      SELECT
        (SELECT groupArray(event) FROM event_data) AS eventList,
        (SELECT groupArray(tuple(source, target, value)) FROM edge_data) AS edgeList
    `

    // 9. 格式化SQL（去除多余空行）
    const formattedSql = finalQuery.replace(/\n\s+/g, '\n').trim()

    return { sql: formattedSql, params: sqlParams }
  } catch (error) {
    return { sql: '', params: {}, error: (error as Error).message }
  }
}
