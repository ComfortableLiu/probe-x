import {
  AttributionModelEnum,
  IAttributionAnalysisFilter,
  IAttributionAnalysisReq,
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
 * 获取指标对应的聚合函数
 */
function getMetricAggregationFunc(metrics: Metrics): string {
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

/**
 * 构建归因模型对应的权重计算逻辑
 */
function buildAttributionWeightLogic(model: AttributionModelEnum): string {
  switch (model) {
    case AttributionModelEnum.FIRST_TOUCH:
      // 首次触点：仅第一个归因点权重为1，其余为0
      return `CASE WHEN a.attribution_index = 0 THEN 1 ELSE 0 END`
    case AttributionModelEnum.LAST_TOUCH:
      // 末次触点：仅最后一个归因点权重为1，其余为0
      return `CASE WHEN a.attribution_index = (SELECT MAX(attribution_index) FROM probe_x.event_attribution WHERE source_page_id = a.source_page_id) THEN 1 ELSE 0 END`
    case AttributionModelEnum.LINEAR:
      // 线性归因：所有归因点均分权重
      return `1 / (SELECT COUNT(*) FROM probe_x.event_attribution WHERE source_page_id = a.source_page_id)`
    case AttributionModelEnum.POSITION:
      // 位置归因：首末各40%，中间均分20%
      return `CASE 
        WHEN a.attribution_index = 0 THEN 0.4
        WHEN a.attribution_index = (SELECT MAX(attribution_index) FROM probe_x.event_attribution WHERE source_page_id = a.source_page_id) THEN 0.4
        ELSE 0.2 / ((SELECT COUNT(*) FROM probe_x.event_attribution WHERE source_page_id = a.source_page_id) - 2)
      END`
    case AttributionModelEnum.TIME_DECAY:
      // 时间衰减归因：基于时间差计算权重（指数衰减）
      return `EXP(-0.1 * DATEDIFF(second, a.event_time, f.$service_time)) / 
              (SELECT SUM(EXP(-0.1 * DATEDIFF(second, event_time, f.$service_time))) 
               FROM probe_x.event_attribution 
               WHERE source_page_id = a.source_page_id)`
    default:
      throw new Error(`不支持的归因模型：${model}`)
  }
}

/**
 * 生成归因分析查询SQL
 */
export function generateAttributionAnalysisSql(params: IAttributionAnalysisReq): ISqlGenerateResult {
  resetParamIndex()
  const sqlParams: Record<string, any> = {}

  try {
    // 基础参数校验
    if (!params.attributionModel) {
      return { sql: '', params: {}, error: '归因模型不能为空' }
    }
    if (!params.targetMetric?.eventInfo) {
      return { sql: '', params: {}, error: '转化目标指标不能为空' }
    }
    if (!params.timeRange || params.timeRange.length !== 2) {
      return { sql: '', params: {}, error: '时间范围格式错误' }
    }

    const {
      attributionModel,
      targetMetric,
      targetDimension,
      timeRange,
      dimension,
      globalFilters = [],
    } = params

    const [startDate, endDate] = timeRange
    const targetEventInfo = targetMetric.eventInfo

    // 1. 处理时间范围过滤（参数化）
    const startParamKey = generateParamKey('time_start')
    const endParamKey = generateParamKey('time_end')
    sqlParams[startParamKey] = `${startDate} 00:00:00.000`
    sqlParams[endParamKey] = `${endDate} 23:59:59.999`
    const timeFilter = `${wrapFieldWithBacktick('$service_time')} BETWEEN toDateTime64({${startParamKey}:String}, 3) AND toDateTime64({${endParamKey}:String}, 3)`

    // 2. 全局过滤条件
    const globalWhereClause = buildFilterClause(globalFilters, sqlParams)

    // 3. 转化目标事件过滤条件
    const targetEventFilters = targetEventInfo.filters || []
    const targetEventWhereClause = buildFilterClause(targetEventFilters, sqlParams)

    // 4. 转化目标事件名过滤
    let targetEventNameFilter = ''
    if (targetEventInfo.eventName) {
      const eventNameParamKey = generateParamKey('target_event_name')
      sqlParams[eventNameParamKey] = targetEventInfo.eventName
      targetEventNameFilter = `${wrapFieldWithBacktick('$event_name')} = {${eventNameParamKey}:String}`
    }

    // 5. 合并所有过滤条件
    const allFilters = [
      timeFilter,
      targetEventNameFilter,
      targetEventWhereClause,
      globalWhereClause,
    ].filter(Boolean)
    const whereClause = allFilters.length > 0 ? `WHERE ${allFilters.join(' AND ')}` : ''

    // 6. 处理维度字段
    const allDimensions = [...new Set([...dimension, ...targetDimension])]
    const dimensionFields = allDimensions.map(field => wrapFieldWithBacktick(field))
    const groupByFields = dimensionFields.length > 0 ? dimensionFields.join(', ') : ''
    const groupByClause = groupByFields ? `GROUP BY ${groupByFields}` : ''

    // 7. 构建归因权重计算逻辑
    const weightLogic = buildAttributionWeightLogic(attributionModel)

    // 8. 获取转化指标聚合函数
    const metricAggFunc = getMetricAggregationFunc(targetEventInfo.metrics)

    // 9. 构建主查询SQL
    const mainTable = '`probe_x`.`final_event_log` f'
    const attrTable = '`probe_x`.`event_attribution` a'

    // 维度字段选择
    const selectDimensionFields = dimensionFields.length > 0
      ? `${dimensionFields.join(', ')},`
      : ''

    // 核心指标计算：转化值、贡献率、转化率
    const conversionValueExpr = `SUM(${weightLogic} * ${metricAggFunc}) AS conversion_value`
    const totalConversionValueExpr = `(SELECT ${metricAggFunc} FROM ${mainTable} ${whereClause}) AS total_conversion_value`
    const contributionRateExpr = `IF(${totalConversionValueExpr} > 0, (conversion_value / ${totalConversionValueExpr}) * 100, 0) AS contribution_rate`
    const conversionRateExpr = `IF(${metricAggFunc} > 0, (conversion_value / ${metricAggFunc}) * 100, 0) AS conversion_rate`

    // 最终SELECT子句
    const selectClause = `${selectDimensionFields}
      ${conversionValueExpr},
      ${contributionRateExpr},
      ${conversionRateExpr},
      ${metricAggFunc} AS total_metric_value`

    // 关联归因表
    const joinClause = `LEFT JOIN ${attrTable} 
      ON f.${wrapFieldWithBacktick('$source_page_id')} = a.source_page_id 
      AND f.${wrapFieldWithBacktick('$service_time')} = a.event_time`

    // 排序规则：按维度升序，贡献率降序
    const orderByFields = dimensionFields.map(f => `${f} ASC`).concat(['contribution_rate DESC'])
    const orderByClause = orderByFields.length > 0 ? `ORDER BY ${orderByFields.join(', ')}` : ''

    // 拼接最终SQL
    const sql = `SELECT ${selectClause}
                 FROM ${mainTable}
                 ${joinClause}
                 ${whereClause}
                 ${groupByClause}
                 ${orderByClause}`

    return { sql, params: sqlParams }
  } catch (error) {
    return { sql: '', params: {}, error: (error as Error).message }
  }
}
