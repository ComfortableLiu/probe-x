import {
  AttributionModelEnum,
  IAttributionAnalysisFilter,
  IAttributionAnalysisReq,
  IEventAnalysisInfo,
  MetaPropertyType,
  Metrics,
} from "@probe-x/shared-types/src"
import { META_TYPE_TO_CH_TYPE } from "@src/api/data-analysis/type"

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
 * 用反引号包裹字段名，防止字段名包含特殊字符导致SQL错误
 */
function wrapFieldWithBacktick(field: string): string {
  return `\`${field.replace(/`/g, '``')}\``
}

/**
 * 清理参数名中的特殊字符，确保参数名合法
 */
function sanitizeParamName(name: string): string {
  return name.replace(/[\$\-\.\s]/g, '_')
}

/**
 * 构建过滤条件子句
 * @param filters 过滤条件数组
 * @param params 参数对象，用于存储参数化查询的值
 * @param indexRef 参数索引引用，确保参数名唯一
 */
function buildFilterClause(filters: IAttributionAnalysisFilter[] = [], params: Record<string, any>, indexRef: {
  value: number
}): string {
  const filterList = Array.isArray(filters) ? filters : []
  if (filterList.length === 0) return ''

  const filterClauses = filterList.map(filter => {
    if (!filter || !filter.propertyName) return ''

    const { propertyName, propertyType, compareType, propertyValue } = filter
    const field = wrapFieldWithBacktick(propertyName)
    const chType = META_TYPE_TO_CH_TYPE[propertyType]

    switch (compareType) {
      case 'EQUAL':
        return buildEqualFilter(field, propertyName, propertyValue, propertyType, chType, params, indexRef)
      case 'NOT_EQUAL':
        return buildNotEqualFilter(field, propertyName, propertyValue, propertyType, chType, params, indexRef)
      case 'GREATER_THAN':
        return buildSingleValueFilter(field, propertyName, propertyValue, propertyType, chType, params, indexRef, '>')
      case 'GREATER_THAN_OR_EQUAL':
        return buildSingleValueFilter(field, propertyName, propertyValue, propertyType, chType, params, indexRef, '>=')
      case 'LESS_THAN':
        return buildSingleValueFilter(field, propertyName, propertyValue, propertyType, chType, params, indexRef, '<')
      case 'LESS_THAN_OR_EQUAL':
        return buildSingleValueFilter(field, propertyName, propertyValue, propertyType, chType, params, indexRef, '<=')
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
    // 空数组返回恒假条件
    if (value.length === 0) return '1=0'
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
    // 空数组返回恒真条件
    if (value.length === 0) return '1=1'
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
  indexRef: { value: number },
  operator: string,
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
  const rangeValue = Array.isArray(value) ? value : []
  if (rangeValue.length !== 2) {
    throw new Error('区间过滤条件必须包含两个值')
  }
  const [min, max] = rangeValue

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
  const values = Array.isArray(value) ? value : (value ? [value] : [])
  if (values.length === 0) return '1=0'
  const containsClauses = values.map((item, idx) => {
    const paramKey = generateParamKey(`string_${sanitizeParamName(propertyName)}_contains_${idx}`, indexRef)
    params[paramKey] = item
    return `position(${field}, {${paramKey}:String}) > 0`
  })
  // 使用括号包裹OR条件，确保与其他AND条件的优先级正确
  return `(${containsClauses.join(' OR ')})`
}

function buildNotContainsFilter(
  field: string,
  propertyName: string,
  value: string[] | string,
  params: Record<string, any>,
  indexRef: { value: number },
): string {
  const values = Array.isArray(value) ? value : (value ? [value] : [])
  if (values.length === 0) return '1=1'
  const notContainsClauses = values.map((item, idx) => {
    const paramKey = generateParamKey(`string_${sanitizeParamName(propertyName)}_not_contains_${idx}`, indexRef)
    params[paramKey] = item
    return `position(${field}, {${paramKey}:String}) = 0`
  })
  // 使用括号包裹AND条件，保持逻辑一致性
  return `(${notContainsClauses.join(' AND ')})`
}

function buildRegexFilter(
  field: string,
  propertyName: string,
  value: string,
  params: Record<string, any>,
  indexRef: { value: number },
): string {
  if (!value) return '1=0'

  const paramKey = generateParamKey(`string_${sanitizeParamName(propertyName)}_regex`, indexRef)
  params[paramKey] = value
  return `${field} REGEXP {${paramKey}:String}`
}

/**
 * 获取指标聚合函数（用于最终结果聚合）
 * @param metrics 指标类型
 * @param isUserCount 是否用于用户数统计（特殊处理）
 */
function getMetricAggregationFunc(metrics: Metrics, isUserCount = false): string {
  if (isUserCount) {
    return `uniq(${wrapFieldWithBacktick('$uid')})`
  }
  switch (metrics) {
    case Metrics.COUNT:
      return 'COUNT(*)'
    case Metrics.USERS:
      return `uniq(${wrapFieldWithBacktick('$uid')})`
    case Metrics.SESSIONS:
      return `uniq(${wrapFieldWithBacktick('$session_id')})`
    default:
      throw new Error(`不支持的指标类型：${metrics}`)
  }
}

/** 构建归因事件过滤条件（多事件OR） */
function buildAttributionEventFilter(attributionEvents: {
  eventInfo: IEventAnalysisInfo
}[], params: Record<string, any>, indexRef: { value: number }): string {
  if (!Array.isArray(attributionEvents) || attributionEvents.length === 0) {
    return '1=0'
  }

  const eventClauses = attributionEvents.map((eventItem, idx) => {
    const eventInfo = eventItem.eventInfo
    if (!eventInfo) return ''

    let eventNameFilter = ''
    if (eventInfo.eventName) {
      const eventNameParamKey = generateParamKey(`attribution_event_name_${idx}`, indexRef)
      params[eventNameParamKey] = eventInfo.eventName
      eventNameFilter = `${wrapFieldWithBacktick('$event_name')} = {${eventNameParamKey}:String}`
    }

    const eventFilterClause = buildFilterClause(eventInfo.filters || [], params, indexRef)
    const eventConditions = [eventNameFilter, eventFilterClause].filter(Boolean)
    return eventConditions.length > 0 ? `(${eventConditions.join(' AND ')})` : ''
  }).filter(Boolean)

  // 使用括号包裹OR组合的事件条件，确保与其他AND条件的优先级正确
  return eventClauses.length > 0 ? `(${eventClauses.join(' OR ')})` : '1=0'
}

/** 构建转化事件过滤条件 */
function buildConversionEventFilter(targetEventInfo: IEventAnalysisInfo, params: Record<string, any>, indexRef: {
  value: number
}): string {
  if (!targetEventInfo) return ''

  const conditions: string[] = []
  if (targetEventInfo.eventName) {
    const eventNameParamKey = generateParamKey('conversion_event_name', indexRef)
    params[eventNameParamKey] = targetEventInfo.eventName
    conditions.push(`${wrapFieldWithBacktick('$event_name')} = {${eventNameParamKey}:String}`)
  }

  const eventFilterClause = buildFilterClause(targetEventInfo.filters || [], params, indexRef)
  if (eventFilterClause) {
    conditions.push(eventFilterClause)
  }

  return conditions.length > 0 ? conditions.join(' AND ') : ''
}

/** 构建归因权重逻辑（基于 conv_rows CTE 预计算的窗口函数列，避免在聚合参数中使用相关子查询） */
function buildAttributionWeightLogic(model: AttributionModelEnum): string {
  // 可用列：idx（attribution_index）、tp_count（该转化的归因行数）、last_idx（最大归因序号）
  // 注意：event_attribution 的 event_time 与转化事件的 $service_time 一致（见表结构注释），
  // 时间衰减公式中 dateDiff(event_time, 转化时间) 恒为 0，衰减项恒为 1，退化为 1/tp_count
  switch (model) {
    case AttributionModelEnum.FIRST_TOUCH:
      return `if(idx = 0, 1, 0)`
    case AttributionModelEnum.LAST_TOUCH:
      return `if(idx = last_idx, 1, 0)`
    case AttributionModelEnum.LINEAR:
      return `1 / tp_count`
    case AttributionModelEnum.POSITION:
      // 位置归因模型：第一个和最后一个触摸点各占40%，中间点均分剩余20%
      return `multiIf(tp_count = 1, 1.0, tp_count = 2, 0.5, idx = 0 OR idx = last_idx, 0.4, 0.2 / (tp_count - 2))`
    case AttributionModelEnum.TIME_DECAY:
      // 见上方注释：当前数据模型下衰减项恒为 1，等价于线性均分
      return `1 / tp_count`
    default:
      throw new Error(`不支持的归因模型：${model}`)
  }
}

/** 构建动态排序子句（prefix 用于多表 JOIN 时限定字段来源，避免歧义） */
function buildDynamicOrderByClause(
  attributionEvents: { eventInfo: IEventAnalysisInfo }[],
  attributionEventDimension: string[],
  params: Record<string, any>,
  indexRef: { value: number },
  prefix = '',
): string {
  const eventNames = attributionEvents
    .map(item => item.eventInfo?.eventName)
    .filter(Boolean) as string[]

  let eventPriorityCase = ''
  if (eventNames.length > 0) {
    const caseWhenParts: string[] = []
    eventNames.forEach((name, index) => {
      const paramKey = generateParamKey(`order_by_event_name_${index}`, indexRef)
      params[paramKey] = name
      caseWhenParts.push(`WHEN {${paramKey}:String} THEN ${index + 1}`)
    })
    const defaultPriority = eventNames.length + 1
    eventPriorityCase = `
      CASE ${prefix}${wrapFieldWithBacktick('$event_name')}
        ${caseWhenParts.join('\n      ')}
        ELSE ${defaultPriority}
      END ASC
    `.trim()
  }

  const dimensionOrderBy = attributionEventDimension
    .map(dim => `${prefix}${wrapFieldWithBacktick(dim)} ASC`)
    .join(', ')

  const orderByParts: string[] = []
  if (eventPriorityCase) orderByParts.push(eventPriorityCase)
  if (dimensionOrderBy) orderByParts.push(dimensionOrderBy)
  orderByParts.push('contribution_rate DESC')

  return `ORDER BY ${orderByParts.join(', ')}`
}

/**
 * 生成归因分析SQL
 * 功能：根据归因模型计算各归因事件的贡献度、转化率等指标
 * @param params 归因分析请求参数
 * @returns SQL生成结果，包含SQL语句、参数和错误信息
 */
export function generateAttributionAnalysisSql(params: IAttributionAnalysisReq): ISqlGenerateResult {
  // 参数索引引用，每个请求独立，确保参数名唯一
  const indexRef = { value: 0 }
  resetParamIndex(indexRef)
  const sqlParams: Record<string, any> = {}

  try {
    if (!params) return { sql: '', params: {}, error: '入参不能为空' }
    if (!params.attributionModel) return { sql: '', params: {}, error: '归因模型不能为空' }
    if (!params.targetMetric?.eventInfo) return { sql: '', params: {}, error: '转化目标指标不能为空' }
    if (!params.timeRange || params.timeRange.length !== 2) return { sql: '', params: {}, error: '时间范围格式错误' }
    if (!Array.isArray(params.attributionEvent) || params.attributionEvent.length === 0) return {
      sql: '',
      params: {},
      error: '归因事件不能为空',
    }

    const {
      attributionModel,
      targetMetric,
      targetDimension = [],
      timeRange,
      attributionEvent,
      attributionEventDimension = [],
      globalFilters = [],
    } = params

    const [startDate, endDate] = timeRange
    const targetEventInfo = targetMetric.eventInfo
    const conversionEventName = targetEventInfo.eventName || '未知事件'

    // 1. 时间过滤
    const startParamKey = generateParamKey('time_start', indexRef)
    const endParamKey = generateParamKey('time_end', indexRef)
    sqlParams[startParamKey] = `${startDate} 00:00:00.000`
    sqlParams[endParamKey] = `${endDate} 23:59:59.999`
    const timeFilter = `${wrapFieldWithBacktick('$service_time')} BETWEEN toDateTime64({${startParamKey}:String}, 3) AND toDateTime64({${endParamKey}:String}, 3)`

    // 2. 全局过滤条件
    const globalFilterConditions = buildFilterClause(globalFilters, sqlParams, indexRef)

    // 3. 归因事件过滤条件
    const attributionEventFilter = buildAttributionEventFilter(attributionEvent, sqlParams, indexRef)

    // 4. 转化事件过滤条件
    const conversionEventFilter = buildConversionEventFilter(targetEventInfo, sqlParams, indexRef)

    // 5. 合并WHERE子句
    const whereConditions = [
      timeFilter,
      attributionEventFilter,
      globalFilterConditions,
    ].filter(Boolean)
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''

    // 6. 维度处理
    const allDimensions = [...new Set([...attributionEventDimension])].filter(Boolean)
    const dimensionFields = allDimensions.map(field => wrapFieldWithBacktick(field))

    // 7. 核心归因计算逻辑
    // 注意：event_attribution 是 KV 子表（每个转化事件有多行 attr_key/attr_value），
    // 且 source_page_id 是页面 id 而非转化事件唯一标识，直接 JOIN 主表会发生行扇出导致贡献度超过 100%。
    // 因此：
    // 1. conv_rows/conv_attr 先按转化事件（source_page_id + event_time）聚合，将每个转化的权重归一化（总和为 1），
    //    权重计算使用窗口函数列（ClickHouse 不支持聚合参数中的相关子查询）
    // 2. linked 按（触点事件, 维度, 转化）去重——同一个转化对同一触点事件只计一次，与触点事件实例数无关
    // 3. 触点事件的总次数/用户数在 event_stats 中单独统计（与转化关联解耦）
    const weightLogic = buildAttributionWeightLogic(attributionModel)
    const conversionMetricAggFunc = getMetricAggregationFunc(targetEventInfo.metrics)

    // 总转化量计算
    const totalConversionSubQuery = `
      (SELECT COALESCE(${conversionMetricAggFunc}, 1) 
       FROM \`probe_x\`.\`final_event_log\` 
       WHERE ${timeFilter} 
       ${conversionEventFilter ? `AND ${conversionEventFilter}` : ''}
       ${globalFilterConditions ? `AND ${globalFilterConditions}` : ''})
    `.trim()

    // 没有关联到转化的触点事件，LEFT JOIN 后 conversion_metric 可能为 NULL（取决于 join_use_nulls），统一兜底为 0
    const cMetric = 'ifNull(c.conversion_metric, 0)'
    const contributionRateExpr = `ROUND((${cMetric} / ${totalConversionSubQuery}) * 100, 2)`
    const contributionProgressExpr = `LEAST(${contributionRateExpr}, 100) AS contribution_progress`

    // 维度字段选择（各 CTE 中保留原始字段名，便于 GROUP BY/ORDER BY 复用）
    const dimensionSelect = dimensionFields.length > 0
      ? dimensionFields.map(field => `f.${field} AS ${field}`).join(', ') + ','
      : ''
    const dimensionGroupBy = dimensionFields.length > 0 ? `${dimensionFields.join(', ')},` : ''
    // event_stats 与 conv_agg 按事件名+维度对齐
    const dimensionJoinOn = dimensionFields.length > 0
      ? dimensionFields.map(field => ` AND e.${field} = c.${field}`).join('')
      : ''
    const dimensionOuterSelect = dimensionFields.length > 0
      ? dimensionFields.map(field => `e.${field}`).join(', ') + ','
      : ''

    // 8. 主表与动态排序子句（外层查询有 e/c 两个表，字段需带 e. 前缀避免歧义）
    const mainTable = '`probe_x`.`final_event_log` f'
    const orderByClause = buildDynamicOrderByClause(attributionEvent, attributionEventDimension, sqlParams, indexRef, 'e.')

    // 触点事件去重键：优先 $event_id（端到端幂等键）；存量历史数据补列前该值为空串，
    // 直接用它去重会把所有老数据塌缩成一条，因此空串时回退（页面+时间+用户）复合键
    const tidExpr = `if(f.${wrapFieldWithBacktick('$event_id')} != '', f.${wrapFieldWithBacktick('$event_id')}, concat(f.${wrapFieldWithBacktick('$page_id')}, '|', toString(f.${wrapFieldWithBacktick('$service_time')}), '|', toString(f.${wrapFieldWithBacktick('$uid')})))`

    // 9. 拼接最终SQL
    // conv_rows 通过（source_page_id + 精确时间戳）JOIN 主表，把归因行限定到「目标转化事件」——
    // 归因表里混有多种转化事件的归因数据，不过滤会导致分子包含非目标转化，贡献度超过 100%
    const sql = `WITH conv_rows AS (
      SELECT
        a.${wrapFieldWithBacktick('source_page_id')} AS spid,
        a.${wrapFieldWithBacktick('event_time')} AS et,
        a.${wrapFieldWithBacktick('attribution_index')} AS idx,
        COUNT(*) OVER (PARTITION BY a.${wrapFieldWithBacktick('source_page_id')}, a.${wrapFieldWithBacktick('event_time')}) AS tp_count,
        MAX(a.${wrapFieldWithBacktick('attribution_index')}) OVER (PARTITION BY a.${wrapFieldWithBacktick('source_page_id')}, a.${wrapFieldWithBacktick('event_time')}) AS last_idx
      FROM \`probe_x\`.\`event_attribution\` a
      JOIN \`probe_x\`.\`final_event_log\` c
        ON c.${wrapFieldWithBacktick('$source_page_id')} = a.${wrapFieldWithBacktick('source_page_id')}
        AND c.${wrapFieldWithBacktick('$service_time')} = a.${wrapFieldWithBacktick('event_time')}
      WHERE ${timeFilter}
      ${conversionEventFilter ? `AND ${conversionEventFilter}` : ''}
      ${globalFilterConditions ? `AND ${globalFilterConditions}` : ''}
    ),
    conv_attr AS (
      SELECT spid, et, SUM(${weightLogic}) AS w
      FROM conv_rows
      GROUP BY spid, et
    ),
    linked AS (
      SELECT DISTINCT
        f.${wrapFieldWithBacktick('$event_name')} AS ${wrapFieldWithBacktick('$event_name')},
        ${dimensionSelect}
        ca.spid AS spid,
        ca.et AS et,
        ca.w AS w
      FROM ${mainTable}
      JOIN conv_attr ca
        ON f.${wrapFieldWithBacktick('$source_page_id')} = ca.spid
        AND toDate(f.${wrapFieldWithBacktick('$service_time')}) = toDate(ca.et)
      ${whereClause}
    ),
    conv_agg AS (
      SELECT
        ${wrapFieldWithBacktick('$event_name')},
        ${dimensionGroupBy}
        SUM(w) AS conversion_metric
      FROM linked
      GROUP BY ${dimensionGroupBy} ${wrapFieldWithBacktick('$event_name')}
    ),
    event_stats AS (
      SELECT
        f.${wrapFieldWithBacktick('$event_name')} AS ${wrapFieldWithBacktick('$event_name')},
        ${dimensionSelect}
        uniqExact(${tidExpr}) AS total_count,
        uniqExact(f.${wrapFieldWithBacktick('$uid')}) AS user_count
      FROM ${mainTable}
      ${whereClause}
      GROUP BY ${dimensionGroupBy} ${wrapFieldWithBacktick('$event_name')}
    )
    SELECT
      e.${wrapFieldWithBacktick('$event_name')} AS attribution_event_name,
      ${dimensionOuterSelect}
      e.total_count AS total_count,
      e.user_count AS user_count,
      ${cMetric} AS attribution_value,
      ${cMetric} AS conversion_metric,
      ROUND((${cMetric} / NULLIF(e.total_count, 0)) * 100, 2) AS conversion_rate,
      ${contributionRateExpr} AS contribution_rate,
      ${contributionProgressExpr}
    FROM event_stats e
    LEFT JOIN conv_agg c
      ON e.${wrapFieldWithBacktick('$event_name')} = c.${wrapFieldWithBacktick('$event_name')}${dimensionJoinOn}
    ${orderByClause}`.trim()

    return {
      sql,
      params: sqlParams,
      error: '',
      headerConfig: {
        conversionEventName: conversionEventName,
        attributionEventDimensions: attributionEventDimension,
        targetDimensions: targetDimension,
      },
    }
  } catch (error) {
    const errMsg = (error as Error).message || 'SQL生成失败'
    return { sql: '', params: {}, error: errMsg }
  }
}

/** SQL生成结果类型 */
export interface ISqlGenerateResult {
  sql: string;
  params: Record<string, any>;
  error: string;
  headerConfig?: {
    conversionEventName: string;
    attributionEventDimensions: string[];
    targetDimensions: string[];
  };
}
