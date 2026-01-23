import {
  FunnelTypeEnum,
  IAttributionAnalysisFilter,
  IFunnelAnalysisReq,
  IFunnelInfo,
  MetaPropertyType,
} from "@probe-x/shared-types/src"
import { ISqlGenerateResult } from "@src/api/data-analysis/type"

/**
 * 元属性类型到ClickHouse数据类型的映射（严格对齐MetaPropertyType枚举）
 */
export const META_TYPE_TO_CH_TYPE: Record<MetaPropertyType, string> = {
  [MetaPropertyType.STRING]: "String",
  [MetaPropertyType.NUMBER]: "Int64",
  [MetaPropertyType.FLOAT]: "Float64",
  [MetaPropertyType.BOOLEAN]: "UInt8",
  [MetaPropertyType.DATE]: "DateTime64",
}

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
 * 用反引号包裹字段名，防止字段名包含特殊字符导致SQL错误
 */
function wrapFieldWithBacktick(field: string): string {
  return `\`${field.replace(/`/g, "``")}\``
}

/**
 * 清理参数名中的特殊字符，确保参数名合法
 */
function sanitizeParamName(name: string): string {
  return name.replace(/[\$\-\.\s]/g, "_")
}

/**
 * 构建过滤条件子句
 */
function buildFilterClause(filters: IAttributionAnalysisFilter[], params: Record<string, any>): string {
  if (filters.length === 0) return ""

  const filterClauses = filters.map((filter) => {
    const { propertyName, propertyType, compareType, propertyValue } = filter
    const field = wrapFieldWithBacktick(propertyName)
    const chType = META_TYPE_TO_CH_TYPE[propertyType]

    switch (compareType) {
      case "EQUAL":
        return buildEqualFilter(field, propertyName, propertyValue, propertyType, chType, params)
      case "NOT_EQUAL":
        return buildNotEqualFilter(field, propertyName, propertyValue, propertyType, chType, params)
      case "GREATER_THAN":
        return buildSingleValueFilter(field, propertyName, propertyValue, propertyType, chType, params, ">")
      case "GREATER_THAN_OR_EQUAL":
        return buildSingleValueFilter(field, propertyName, propertyValue, propertyType, chType, params, ">=")
      case "LESS_THAN":
        return buildSingleValueFilter(field, propertyName, propertyValue, propertyType, chType, params, "<")
      case "LESS_THAN_OR_EQUAL":
        return buildSingleValueFilter(field, propertyName, propertyValue, propertyType, chType, params, "<=")
      case "RANGE":
        return buildRangeFilter(field, propertyName, propertyValue as number[] | string[], propertyType, chType, params)
      case "CONTAINS":
        return buildContainsFilter(field, propertyName, propertyValue as string[] | string, params)
      case "NOT_CONTAINS":
        return buildNotContainsFilter(field, propertyName, propertyValue as string[] | string, params)
      case "REGEX":
        return buildRegexFilter(field, propertyName, propertyValue as string, params)
      default:
        throw new Error(`不支持的比较类型：${compareType}`)
    }
  })

  return filterClauses.filter(Boolean).join(" AND ")
}

/**
 * 构建等于过滤条件
 */
function buildEqualFilter(
  field: string,
  propertyName: string,
  value: string | number | boolean | string[] | number[],
  propertyType: MetaPropertyType,
  chType: string,
  params: Record<string, any>,
): string {
  if (Array.isArray(value)) {
    const paramKeys = value.map((item, idx) => {
      const processedItem = propertyType === MetaPropertyType.BOOLEAN ? (item ? 1 : 0) : item
      const paramKey = generateParamKey(`${propertyType}_${sanitizeParamName(propertyName)}_equal_${idx}`)
      params[paramKey] = processedItem
      return `{${paramKey}:${chType}}`
    })
    return `${field} IN (${paramKeys.join(", ")})`
  }

  const processedValue = propertyType === MetaPropertyType.BOOLEAN ? (value ? 1 : 0) : value
  const paramKey = generateParamKey(`${propertyType}_${sanitizeParamName(propertyName)}_equal`)
  params[paramKey] = processedValue
  return `${field} = {${paramKey}:${chType}}`
}

/**
 * 构建不等于过滤条件
 */
function buildNotEqualFilter(
  field: string,
  propertyName: string,
  value: string | number | boolean | string[] | number[],
  propertyType: MetaPropertyType,
  chType: string,
  params: Record<string, any>,
): string {
  if (Array.isArray(value)) {
    const paramKeys = value.map((item, idx) => {
      const processedItem = propertyType === MetaPropertyType.BOOLEAN ? (item ? 1 : 0) : item
      const paramKey = generateParamKey(`${propertyType}_${sanitizeParamName(propertyName)}_not_equal_${idx}`)
      params[paramKey] = processedItem
      return `{${paramKey}:${chType}}`
    })
    return `${field} NOT IN (${paramKeys.join(", ")})`
  }

  const processedValue = propertyType === MetaPropertyType.BOOLEAN ? (value ? 1 : 0) : value
  const paramKey = generateParamKey(`${propertyType}_${sanitizeParamName(propertyName)}_not_equal`)
  params[paramKey] = processedValue
  return `${field} != {${paramKey}:${chType}}`
}

/**
 * 构建单值比较过滤条件（> >= < <=）
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
  const processedValue = propertyType === MetaPropertyType.BOOLEAN ? (value ? 1 : 0) : value
  const operatorKey = operator.replace(/=/g, "eq").replace(/>/g, "gt").replace(/</g, "lt")
  const paramKey = generateParamKey(`${propertyType}_${sanitizeParamName(propertyName)}_${operatorKey}`)
  params[paramKey] = processedValue
  return `${field} ${operator} {${paramKey}:${chType}}`
}

/**
 * 构建区间过滤条件（RANGE）
 */
function buildRangeFilter(
  field: string,
  propertyName: string,
  value: number[] | string[],
  propertyType: MetaPropertyType,
  chType: string,
  params: Record<string, any>,
): string {
  if (value.length !== 2) throw new Error(`区间过滤条件必须包含两个值：${propertyName}`)

  const [min, max] = value
  const minParamKey = generateParamKey(`${propertyType}_${sanitizeParamName(propertyName)}_range_min`)
  const maxParamKey = generateParamKey(`${propertyType}_${sanitizeParamName(propertyName)}_range_max`)

  params[minParamKey] = min
  params[maxParamKey] = max

  return `${field} BETWEEN {${minParamKey}:${chType}} AND {${maxParamKey}:${chType}}`
}

/**
 * 构建包含过滤条件（CONTAINS）
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
  return containsClauses.join(" OR ")
}

/**
 * 构建不包含过滤条件（NOT_CONTAINS）
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
  return notContainsClauses.join(" AND ")
}

/**
 * 构建正则匹配过滤条件（REGEX）
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
 * 获取漏斗类型对应的聚合函数
 */
function getFunnelAggregationFunc(funnelType: FunnelTypeEnum): string {
  switch (funnelType) {
    case FunnelTypeEnum.COUNT:
      return `COUNT(*)`
    case FunnelTypeEnum.USER:
      return `COUNT(DISTINCT ${wrapFieldWithBacktick("$uid")})`
    case FunnelTypeEnum.SESSION:
      return `COUNT(DISTINCT ${wrapFieldWithBacktick("$session_id")})`
    default:
      throw new Error(`不支持的漏斗类型：${funnelType}`)
  }
}

/**
 * 生成步骤事件条件
 * 使用CASE WHEN将所有步骤判断合并为一个step字段，避免重复别名
 * @returns stepCaseExpr: step字段表达式，stepFilterExpr: 过滤有效步骤的表达式
 */
function buildStepCaseExpr(
  funnelSteps: IFunnelInfo[],
  params: Record<string, any>,
): {
  stepCaseExpr: string;
  stepFilterExpr: string;
} {
  let caseWhenParts: string[] = []

  // 为每个步骤生成CASE WHEN分支，最终合并为一个step字段
  funnelSteps.forEach((step, index) => {
    const { eventInfo } = step
    const stepNum = index + 1
    const { eventName, filters = [] } = eventInfo

    // 构建当前步骤的条件
    let eventNameCondition = "1=1"
    if (eventName) {
      const paramKey = generateParamKey(`step_${stepNum}_event_name`)
      params[paramKey] = eventName
      eventNameCondition = `${wrapFieldWithBacktick("$event_name")} = {${paramKey}:String}`
    }

    const stepFilterClause = buildFilterClause(filters, params)
    const stepConditions = [eventNameCondition, stepFilterClause].filter(Boolean)
    const condition = stepConditions.join(" AND ")

    // 添加当前步骤的CASE WHEN分支
    caseWhenParts.push(`WHEN ${condition} THEN ${stepNum}`)
  })

  // 构建CASE WHEN表达式：匹配到步骤则返回步骤编号，否则返回0
  const stepCaseExpr = `CASE ${caseWhenParts.join(" ")} ELSE 0 END AS ${wrapFieldWithBacktick("step")}`
  // 过滤条件：仅保留有效步骤（step > 0表示匹配到某个步骤）
  const stepFilterExpr = `${wrapFieldWithBacktick("step")} > 0`

  return { stepCaseExpr, stepFilterExpr }
}

/**
 * 生成漏斗分析SQL
 * 功能：分析用户在指定时间窗口内完成漏斗步骤的转化情况
 * @param params 漏斗分析请求参数
 * @returns SQL生成结果，包含SQL语句、参数和错误信息
 */
export function generateFunnelAnalysisSql(params: IFunnelAnalysisReq): ISqlGenerateResult {
  resetParamIndex()
  const sqlParams: Record<string, any> = {}

  try {
    // 1. 基础参数校验
    if (!params.funnelInfoList || params.funnelInfoList.length === 0) {
      return { sql: "", params: {}, error: "漏斗步骤不能为空" }
    }
    if (!params.timeRange || params.timeRange.length !== 2) {
      return { sql: "", params: {}, error: "时间范围格式错误" }
    }
    if (!params.windowPeriod || typeof params.windowPeriod.value !== "number" || !["m", "h", "d"].includes(params.windowPeriod.unit)) {
      return { sql: "", params: {}, error: "窗口期参数格式错误" }
    }
    
    // 提供默认漏斗模式
    const funnelMode = params.funnelMode || 'strict'
    if (!["strict", "loose"].includes(funnelMode)) {
      return { sql: "", params: {}, error: "漏斗模式只能是strict或loose" }
    }

    const [startDate, endDate] = params.timeRange
    const { funnelType, dimension = [], globalFilters = [] } = params

    // 2. 时间范围过滤（使用$log_time，即用户事件产生的时间）
    // 统一使用toDateTime64保持精度一致
    const startParamKey = generateParamKey("time_start")
    const endParamKey = generateParamKey("time_end")
    sqlParams[startParamKey] = `${startDate} 00:00:00.000`
    sqlParams[endParamKey] = `${endDate} 23:59:59.999`
    const timeFilter = `${wrapFieldWithBacktick("$log_time")} BETWEEN toDateTime64({${startParamKey}:String}, 3) AND toDateTime64({${endParamKey}:String}, 3)`

    // 3. 全局过滤条件
    const globalWhereClause = buildFilterClause(globalFilters, sqlParams)
    const whereClauses = [timeFilter, globalWhereClause].filter(Boolean)
    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : ""

    // 4. 维度字段处理
    const dimensionFields = [...new Set(dimension)].map(field => wrapFieldWithBacktick(field))
    const dimensionStr = dimensionFields.join(", ")
    const groupByClause = dimensionStr ? `GROUP BY ${dimensionStr}` : ""
    const orderByClause = dimensionStr ? `ORDER BY ${dimensionStr} ASC` : ""

    // 5. 构建step字段：使用CASE WHEN将所有步骤判断合并为一个字段
    const { stepCaseExpr, stepFilterExpr } = buildStepCaseExpr(params.funnelInfoList, sqlParams)

    // 6. 窗口期配置：使用INTERVAL语法计算时间窗口
    const windowValueParamKey = generateParamKey("window_value")
    sqlParams[windowValueParamKey] = params.windowPeriod.value
    const unitMap: Record<string, string> = { m: "MINUTE", h: "HOUR", d: "DAY" }
    const windowUnit = unitMap[params.windowPeriod.unit]
    const intervalExpr = `${wrapFieldWithBacktick("prev_time")} + INTERVAL {${windowValueParamKey}:Int64} ${windowUnit}`

    // 7. 漏斗模式参数
    const modeParamKey = generateParamKey("funnel_mode")
    sqlParams[modeParamKey] = funnelMode
    const modePlaceholder = `{${modeParamKey}:String}`

    // 8. 聚合函数配置
    const metricsAggExpr = getFunnelAggregationFunc(funnelType)

    // 9. 必须包含的字段（用户ID/会话ID，COUNT模式不需要额外字段）
    const requiredFields = [wrapFieldWithBacktick("$log_time")]
    if (funnelType === FunnelTypeEnum.USER) {
      requiredFields.push(wrapFieldWithBacktick("$uid"))
    } else if (funnelType === FunnelTypeEnum.SESSION) {
      requiredFields.push(wrapFieldWithBacktick("$session_id"))
    }

    // 10. PARTITION BY 字段
    const partitionByFields = [...dimensionFields, ...requiredFields.slice(1)]
    const partitionByClause = partitionByFields.length > 0 ? partitionByFields.join(", ") : "1"

    // 11. 构建最终SQL
    // 正确处理WHERE子句：如果已有whereClause则追加AND，否则使用WHERE
    const tableName = "`probe_x`.`final_event_log`"
    const baseWhereClause = whereClause 
      ? `${whereClause} AND ${stepFilterExpr}` 
      : `WHERE ${stepFilterExpr}`
    const sql = `WITH
base_data AS (
  SELECT
    ${[...dimensionFields, ...requiredFields, stepCaseExpr].join(", ")}
  FROM ${tableName}
  ${baseWhereClause}
),
ordered_steps AS (
  SELECT
    ${[...dimensionFields, ...requiredFields, wrapFieldWithBacktick("step")].join(", ")},
    lag(${wrapFieldWithBacktick("step")}) OVER (PARTITION BY ${partitionByClause} ORDER BY ${wrapFieldWithBacktick("$log_time")}) AS ${wrapFieldWithBacktick("prev_step")},
    lag(${wrapFieldWithBacktick("$log_time")}) OVER (PARTITION BY ${partitionByClause} ORDER BY ${wrapFieldWithBacktick("$log_time")}) AS ${wrapFieldWithBacktick("prev_time")}
  FROM base_data
),
valid_steps AS (
  SELECT
    ${[...dimensionFields, ...requiredFields, wrapFieldWithBacktick("step")].join(", ")}
  FROM ordered_steps
  WHERE
    (
      ${modePlaceholder} = 'strict' AND ${wrapFieldWithBacktick("step")} = 1
      OR
      ${modePlaceholder} = 'loose' AND ${wrapFieldWithBacktick("step")} > 0
    )
      AND (
        ${wrapFieldWithBacktick("prev_step")} IS NULL
        OR (
          -- 步骤连续性检查：当前步骤必须是上一个步骤+1，且必须在时间窗口内
          ${wrapFieldWithBacktick("step")} = (CASE WHEN isNull(${wrapFieldWithBacktick("prev_step")}) THEN 0 ELSE ${wrapFieldWithBacktick("prev_step")} END) + 1
          AND ${wrapFieldWithBacktick("$log_time")} <= ${intervalExpr}
        )
      )
),
step_agg AS (
  SELECT
    ${dimensionStr},
    ${wrapFieldWithBacktick("step")},
    ${metricsAggExpr} AS ${wrapFieldWithBacktick("value")}
  FROM valid_steps
  ${dimensionStr ? `GROUP BY ${wrapFieldWithBacktick("step")}, ${dimensionStr}` : `GROUP BY ${wrapFieldWithBacktick("step")}`}
)
SELECT
  ${dimensionFields.map(field => `COALESCE(${field}, '') AS ${field}`).join(", ")},
  ${params.funnelInfoList.map((stepInfo, index) => {
      const stepNum = index + 1
      // 优先使用stepName作为字段名，为空则使用默认命名
      const stepFieldName = stepInfo.stepName
        ? stepInfo.stepName
        : `step_${stepNum}_value`
      return `MAX(CASE WHEN ${wrapFieldWithBacktick("step")} = ${stepNum} THEN ${wrapFieldWithBacktick("value")} ELSE 0 END) AS ${wrapFieldWithBacktick(stepFieldName)}`
    }).join(", ")}
FROM step_agg
${groupByClause}
${orderByClause};`.trim()

    return { sql, params: sqlParams, error: undefined }
  } catch (error) {
    return {
      sql: "",
      params: {},
      error: error instanceof Error ? error.message : "生成漏斗SQL失败：未知错误",
    }
  }
}
