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
 * 生成唯一占位符名称（复用项目Demo逻辑）
 */
let paramIndex = 0
function generateParamKey(prefix: string): string {
  paramIndex += 1
  return `param_${prefix}_${paramIndex}`
}

/**
 * 重置占位符索引（复用项目Demo逻辑）
 */
function resetParamIndex() {
  paramIndex = 0
}

/**
 * 强制用反引号包裹字段名（复用项目Demo逻辑）
 */
function wrapFieldWithBacktick(field: string): string {
  return `\`${field.replace(/`/g, "``")}\``
}

/**
 * 清理参数名中的特殊字符（复用项目Demo逻辑）
 */
function sanitizeParamName(name: string): string {
  return name.replace(/[\$\-\.\s]/g, "_")
}

/**
 * 构建过滤条件子句（严格对齐IAttributionAnalysisFilter接口）
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
 * 获取漏斗类型对应的聚合函数（核心修复：COUNT模式用COUNT(*)，无$event_unique_id）
 */
function getFunnelAggregationFunc(funnelType: FunnelTypeEnum): string {
  switch (funnelType) {
    case FunnelTypeEnum.COUNT:
      return `COUNT(*)` // 修复：直接COUNT(*)，不需要任何字段
    case FunnelTypeEnum.USER:
      return `COUNT(DISTINCT ${wrapFieldWithBacktick("$uid")})`
    case FunnelTypeEnum.SESSION:
      return `COUNT(DISTINCT ${wrapFieldWithBacktick("$session_id")})`
    default:
      throw new Error(`不支持的漏斗类型：${funnelType}`)
  }
}

/**
 * 生成步骤事件条件（核心修复：每个步骤唯一别名，最终用CASE WHEN合并为一个step字段）
 */
function buildStepCaseExpr(
  funnelSteps: IFunnelInfo[],
  params: Record<string, any>,
): {
  stepCaseExpr: string; // 最终的step字段表达式（无重复别名）
  stepFilterExpr: string; // 过滤有效步骤的表达式
} {
  let caseWhenParts: string[] = []

  // 生成多分支CASE WHEN（一个字段包含所有步骤判断）
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

  // 最终CASE WHEN表达式（一个step字段，无重复别名）
  const stepCaseExpr = `CASE ${caseWhenParts.join(" ")} ELSE 0 END AS ${wrapFieldWithBacktick("step")}`
  // 过滤条件：仅保留有效步骤（step > 0）
  const stepFilterExpr = `${wrapFieldWithBacktick("step")} > 0`

  return { stepCaseExpr, stepFilterExpr }
}

/**
 * 工具函数：生成ClickHouse查询SQL（最终适配版，贴合实际场景）
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
    if (!["strict", "loose"].includes(params.funnelMode)) {
      return { sql: "", params: {}, error: "漏斗模式只能是strict或loose" }
    }

    const [startDate, endDate] = params.timeRange
    const { funnelType, funnelMode, dimension = [], globalFilters = [] } = params

    // 2. 时间范围过滤（用toDateTime兼容老版本）
    const startParamKey = generateParamKey("time_start")
    const endParamKey = generateParamKey("time_end")
    sqlParams[startParamKey] = `${startDate}`
    sqlParams[endParamKey] = `${endDate}`
    const timeFilter = `${wrapFieldWithBacktick("$log_time")} BETWEEN toDateTime({${startParamKey}:String}) AND toDateTime({${endParamKey}:String})`

    // 3. 全局过滤条件
    const globalWhereClause = buildFilterClause(globalFilters, sqlParams)
    const whereClauses = [timeFilter, globalWhereClause].filter(Boolean)
    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : ""

    // 4. 维度字段处理
    const dimensionFields = [...new Set(dimension)].map(field => wrapFieldWithBacktick(field))
    const dimensionStr = dimensionFields.join(", ")
    const groupByClause = dimensionStr ? `GROUP BY ${dimensionStr}` : ""
    const orderByClause = dimensionStr ? `ORDER BY ${dimensionStr} ASC` : ""

    // 5. 构建step字段（核心修复：一个CASE WHEN表达式，无重复别名）
    const { stepCaseExpr, stepFilterExpr } = buildStepCaseExpr(params.funnelInfoList, sqlParams)

    // 6. 窗口期配置（用INTERVAL原生语法，100%兼容）
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

    // 11. 最终SQL构建（核心修改：用stepName生成结果字段名，空值兜底）
    const tableName = "`probe_x`.`final_event_log`"
    const sql = `WITH
base_data AS (
  SELECT
    ${[...dimensionFields, ...requiredFields, stepCaseExpr].join(", ")}
  FROM ${tableName}
  ${whereClause}
  AND ${stepFilterExpr}
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
        -- 兼容所有版本：isNull + CASE WHEN
        ${wrapFieldWithBacktick("step")} = (CASE WHEN isNull(${wrapFieldWithBacktick("prev_step")}) THEN 0 ELSE ${wrapFieldWithBacktick("prev_step")} END) + 1
        -- 原生INTERVAL语法，无兼容问题
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
      // 核心修改：优先使用stepName，为空则用默认命名（step_${stepNum}_value）
      const stepFieldName = stepInfo.stepName
        ? stepInfo.stepName  // 用传入的stepName 作为字段名
        : `step_${stepNum}_value`       // 兜底：避免字段名空值
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
