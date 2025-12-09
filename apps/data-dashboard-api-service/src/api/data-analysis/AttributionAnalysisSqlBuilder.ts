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

function wrapFieldWithBacktick(field: string): string {
  return `\`${field.replace(/`/g, '``')}\``
}

function sanitizeParamName(name: string): string {
  return name.replace(/[\$\-\.\s]/g, '_')
}

/**
 * 安全转义SQL字符串值（防止SQL注入）
 * @param value 需转义的字符串
 * @returns 转义后的安全字符串
 */
function escapeSqlString(value: string): string {
  return value.replace(/(['\\])/g, '\\$1')
}

/** 构建过滤条件子句 */
function buildFilterClause(filters: IAttributionAnalysisFilter[] = [], params: Record<string, any>, indexRef: { value: number }): string {
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
  return containsClauses.join(' OR ')
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
  return notContainsClauses.join(' AND ')
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

/** 获取基础指标计算逻辑（非聚合，用于归因权重计算） */
function getBaseMetricLogic(metrics: Metrics): string {
  switch (metrics) {
    case Metrics.COUNT:
      return '1'
    case Metrics.USERS:
      return `if(isNotNull(${wrapFieldWithBacktick('$uid')}), 1, 0)`
    case Metrics.SESSIONS:
      return `if(isNotNull(${wrapFieldWithBacktick('$session_id')}), 1, 0)`
    default:
      throw new Error(`不支持的指标类型：${metrics}`)
  }
}

/** 获取指标聚合函数（用于最终结果聚合） */
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
function buildAttributionEventFilter(attributionEvents: { eventInfo: IEventAnalysisInfo }[], params: Record<string, any>, indexRef: { value: number }): string {
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

  return eventClauses.length > 0 ? eventClauses.join(' OR ') : '1=0'
}

/** 构建转化事件过滤条件 */
function buildConversionEventFilter(targetEventInfo: IEventAnalysisInfo, params: Record<string, any>, indexRef: { value: number }): string {
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

/** 构建归因权重逻辑 */
function buildAttributionWeightLogic(model: AttributionModelEnum): string {
  const serviceTimeField = `f.${wrapFieldWithBacktick('$service_time')}`
  const sourcePageIdField = wrapFieldWithBacktick('$source_page_id')
  const attributionIndexField = wrapFieldWithBacktick('attribution_index')
  const eventTimeField = wrapFieldWithBacktick('event_time')

  switch (model) {
    case AttributionModelEnum.FIRST_TOUCH:
      return `CASE WHEN a.${attributionIndexField} = 0 THEN 1 ELSE 0 END`
    case AttributionModelEnum.LAST_TOUCH:
      return `CASE WHEN a.${attributionIndexField} = (SELECT COALESCE(MAX(${attributionIndexField}), 0) FROM probe_x.event_attribution WHERE ${sourcePageIdField} = a.${sourcePageIdField}) THEN 1 ELSE 0 END`
    case AttributionModelEnum.LINEAR:
      return `1 / COALESCE((SELECT COUNT(*) FROM probe_x.event_attribution WHERE ${sourcePageIdField} = a.${sourcePageIdField}), 1)`
    case AttributionModelEnum.POSITION:
      return `CASE 
        WHEN a.${attributionIndexField} = 0 THEN 0.4
        WHEN a.${attributionIndexField} = (SELECT COALESCE(MAX(${attributionIndexField}), 0) FROM probe_x.event_attribution WHERE ${sourcePageIdField} = a.${sourcePageIdField}) THEN 0.4
        ELSE COALESCE(0.2 / NULLIF((SELECT COUNT(*) FROM probe_x.event_attribution WHERE ${sourcePageIdField} = a.${sourcePageIdField}) - 2, 0), 1)
      END`
    case AttributionModelEnum.TIME_DECAY:
      return `EXP(-0.1 * DATEDIFF(second, a.${eventTimeField}, ${serviceTimeField})) / 
              COALESCE((SELECT SUM(EXP(-0.1 * DATEDIFF(second, ${eventTimeField}, ${serviceTimeField}))) 
               FROM probe_x.event_attribution WHERE ${sourcePageIdField} = a.${sourcePageIdField}), 1)`
    default:
      throw new Error(`不支持的归因模型：${model}`)
  }
}

/** 构建动态排序子句 */
function buildDynamicOrderByClause(
  attributionEvents: { eventInfo: IEventAnalysisInfo }[],
  attributionEventDimension: string[],
  params: Record<string, any>,
  indexRef: { value: number },
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
      CASE ${wrapFieldWithBacktick('$event_name')}
        ${caseWhenParts.join('\n      ')}
        ELSE ${defaultPriority}
      END ASC
    `.trim()
  }

  const dimensionOrderBy = attributionEventDimension
    .map(dim => `${wrapFieldWithBacktick(dim)} ASC`)
    .join(', ')

  const orderByParts: string[] = []
  if (eventPriorityCase) orderByParts.push(eventPriorityCase)
  if (dimensionOrderBy) orderByParts.push(dimensionOrderBy)
  orderByParts.push('contribution_rate DESC')

  return `ORDER BY ${orderByParts.join(', ')}`
}

/** 生成适配表格展示的归因分析SQL */
export function generateAttributionAnalysisSql(params: IAttributionAnalysisReq): ISqlGenerateResult {
  // 局部索引，每个请求独立
  const indexRef = { value: 0 }
  resetParamIndex(indexRef)
  const sqlParams: Record<string, any> = {}

  try {
    if (!params) return { sql: '', params: {}, error: '入参不能为空' }
    if (!params.attributionModel) return { sql: '', params: {}, error: '归因模型不能为空' }
    if (!params.targetMetric?.eventInfo) return { sql: '', params: {}, error: '转化目标指标不能为空' }
    if (!params.timeRange || params.timeRange.length !== 2) return { sql: '', params: {}, error: '时间范围格式错误' }
    if (!Array.isArray(params.attributionEvent) || params.attributionEvent.length === 0) return { sql: '', params: {}, error: '归因事件不能为空' }

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
    const groupByFields = dimensionFields.length > 0 ? dimensionFields.join(', ') : ''
    const groupByClause = groupByFields
      ? `GROUP BY ${groupByFields}, ${wrapFieldWithBacktick('$event_name')}`
      : `GROUP BY ${wrapFieldWithBacktick('$event_name')}`

    // 7. 核心归因计算逻辑
    const weightLogic = buildAttributionWeightLogic(attributionModel)
    const baseMetricLogic = getBaseMetricLogic(targetEventInfo.metrics)
    const conversionMetricAggFunc = getMetricAggregationFunc(targetEventInfo.metrics)
    const attributionCountAggFunc = getMetricAggregationFunc(Metrics.COUNT)
    const attributionUserAggFunc = getMetricAggregationFunc(Metrics.COUNT, true)

    // 补充缺失的conversion_metric和conversion_rate字段
    const attributionValueExpr = `SUM(${weightLogic} * ${baseMetricLogic}) AS attribution_value`
    const conversionMetricExpr = `SUM(${weightLogic} * ${baseMetricLogic}) AS conversion_metric`
    const conversionRateExpr = `ROUND((SUM(${weightLogic} * ${baseMetricLogic}) / NULLIF(SUM(${baseMetricLogic}), 0)) * 100, 2) AS conversion_rate`

    // 总转化量计算
    const totalConversionSubQuery = `
      (SELECT COALESCE(${conversionMetricAggFunc}, 1) 
       FROM \`probe_x\`.\`final_event_log\` 
       WHERE ${timeFilter} 
       ${conversionEventFilter ? `AND ${conversionEventFilter}` : ''}
       ${globalFilterConditions ? `AND ${globalFilterConditions}` : ''})
    `.trim()

    const contributionRateExpr = `ROUND((SUM(${weightLogic} * ${baseMetricLogic}) / ${totalConversionSubQuery}) * 100, 2) AS contribution_rate`
    const contributionProgressExpr = `LEAST(${contributionRateExpr.replace(' AS contribution_rate', '')}, 100) AS contribution_progress`

    // 归因事件基础指标
    const attributionEventNameExpr = `${wrapFieldWithBacktick('$event_name')} AS attribution_event_name`
    const attributionCountExpr = `${attributionCountAggFunc} AS total_count`
    const attributionUserExpr = `${attributionUserAggFunc} AS user_count`

    // 维度字段选择
    const dimensionSelect = dimensionFields.length > 0 ? `${dimensionFields.join(', ')},` : ''

    // 最终SELECT子句（补充缺失字段）
    const selectClause = `
      ${attributionEventNameExpr},
      ${dimensionSelect}
      ${attributionCountExpr},
      ${attributionUserExpr},
      ${attributionValueExpr},
      ${conversionMetricExpr},
      ${conversionRateExpr},
      ${contributionRateExpr},
      ${contributionProgressExpr}
    `.trim()

    // 表关联
    const mainTable = '`probe_x`.`final_event_log` f'
    const attrTable = '`probe_x`.`event_attribution` a'
    const joinClause = `LEFT JOIN ${attrTable} 
      ON f.${wrapFieldWithBacktick('$source_page_id')} = a.${wrapFieldWithBacktick('$source_page_id')} 
      AND toDate(f.${wrapFieldWithBacktick('$service_time')}) = toDate(a.${wrapFieldWithBacktick('event_time')})`

    // 动态排序子句
    const orderByClause = buildDynamicOrderByClause(attributionEvent, attributionEventDimension, sqlParams, indexRef)

    // 拼接最终SQL
    const sql = `SELECT ${selectClause}
                 FROM ${mainTable}
                 ${joinClause}
                 ${whereClause}
                 ${groupByClause}
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
