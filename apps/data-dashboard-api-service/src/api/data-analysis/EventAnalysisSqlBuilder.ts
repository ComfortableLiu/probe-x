import { CompareType, IEventAnalysisInfo, IEventAnalysisReq, MetaPropertyType } from "@probe-x/shared-types/src"

// 类型映射（保持 DateTime64 不带精度）
const META_TYPE_TO_CH_TYPE: Record<MetaPropertyType, string> = {
  [MetaPropertyType.STRING]: 'String',
  [MetaPropertyType.NUMBER]: 'Int64',
  [MetaPropertyType.FLOAT]: 'Float64',
  [MetaPropertyType.BOOLEAN]: 'UInt8',
  [MetaPropertyType.DATE]: 'DateTime64', // 不带精度
}

// 扩展 CompareType 类型，包含自定义后缀
type ExtendedCompareType = CompareType | 'RANGE_START' | 'RANGE_END' | 'IN' | 'CONTAINS_ITEM'

/**
 * 生成唯一占位符 key（格式：my_字段名_比较类型_索引，确保合法无特殊字符）
 */
const generatePlaceholderKey = (field: string, compareType: ExtendedCompareType, index: number): string => {
  let cleanField = field.replace(/[^\w\d]/g, '_')
  cleanField = cleanField.replace(/^[_0-9]+/, '')
  if (!cleanField) cleanField = 'default'
  return `my_${cleanField}_${compareType}_${index}`
}

// SQL 生成工具类（最终版：纯日期 YYYY-MM-DD + 分区过滤优化）
class EventAnalysisSqlBuilder {
  private readonly TABLE_NAME = 'probe_x.event_log'
  private readonly PARTITION_FIELD = '$service_time' // 假设分区字段为 DateTime64 类型，分区键为 toDate($service_time)

  /**
   * 生成查询 SQL（纯日期格式 + 分区过滤生效）
   */
  buildSql(req: IEventAnalysisReq): { sql: string; params: Record<string, string | number | boolean> } {
    const params: Record<string, string | number | boolean> = {}

    // 1. 校验必填参数
    this.validateRequiredParams(req)

    // 2. 构建 SELECT 子句
    const selectFields = this.buildSelectClause(req.eventInfoList, req.dimension, params)
    const selectClause = `SELECT ${selectFields}`

    // 3. 构建 FROM 子句
    const fromClause = `FROM ${this.TABLE_NAME}`

    // 4. 构建 WHERE 子句（纯日期过滤 + 分区生效）
    const { whereClause, whereParams } = this.buildWhereClauses(req)
    Object.assign(params, whereParams)

    // 5. 构建 GROUP BY / ORDER BY 子句
    const groupByClause = this.buildGroupByClause(req.dimension)
    const orderByClause = this.buildOrderByClause(req.dimension)

    // 拼接 SQL
    const sqlParts = [selectClause, fromClause, whereClause, groupByClause, orderByClause].filter(Boolean)
    const sql = sqlParts.join('\n')

    return { sql, params }
  }

  /**
   * 校验必填参数
   */
  private validateRequiredParams(req: IEventAnalysisReq): void {
    const { eventInfoList, timeRange } = req

    if (!eventInfoList || eventInfoList.length === 0) {
      throw new Error('事件列表不能为空')
    }
    const validEvents = eventInfoList.filter(info => info.eventName?.trim())
    if (validEvents.length === 0) {
      throw new Error('至少需要指定一个有效事件（eventName 不能为空）')
    }

    if (!timeRange || timeRange.length !== 2) {
      throw new Error('时间范围需传入 [开始日期, 结束日期]（格式：YYYY-MM-DD）')
    }
    const [startDate, endDate] = timeRange
    // 校验纯日期格式（避免时分秒干扰）
    const startDateObj = new Date(startDate)
    const endDateObj = new Date(endDate)
    if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime()) ||
      startDateObj.toISOString().split('T')[0] !== startDate ||
      endDateObj.toISOString().split('T')[0] !== endDate) {
      throw new Error('时间范围格式错误，仅支持纯日期格式：YYYY-MM-DD（如 2025-11-05）')
    }
    if (startDateObj > endDateObj) {
      throw new Error('开始日期不能晚于结束日期')
    }
  }

  /**
   * 构建 SELECT 子句
   */
  private buildSelectClause(
    eventInfoList: IEventAnalysisInfo[],
    dimension: string[] = [],
    params: Record<string, string | number | boolean>,
  ): string {
    const dimensionFields = [...new Set(dimension)]
      .map(field => this.escapeFieldName(field))
      .join(', ')

    const eventMetrics = eventInfoList.map((eventInfo, index) => {
      const eventName = eventInfo.eventName!.trim()
      const eventAlias = this.escapeAlias(eventName)
      const field = '$event_name'
      const placeholderKey = generatePlaceholderKey(field, 'EQUAL', index)
      const chType = META_TYPE_TO_CH_TYPE[MetaPropertyType.STRING]
      const placeholder = `{${placeholderKey}: ${chType}}`
      params[placeholderKey] = eventName

      return `sumIf(1, \`$event_name\` = ${placeholder}) as ${eventAlias}_count`
    })

    return dimensionFields
      ? [...dimensionFields.split(', '), ...eventMetrics].join(',\n  ')
      : eventMetrics.join(',\n  ')
  }

  /**
   * 构建 WHERE 子句（核心：纯日期过滤 + 分区键对齐，避免全表扫描）
   */
  private buildWhereClauses(req: IEventAnalysisReq): { whereClause: string; whereParams: Record<string, string | number | boolean> } {
    const { eventInfoList, timeRange, globalFilters = [] } = req
    const clauses: string[] = []
    const whereParams: Record<string, string | number | boolean> = {}
    const [startDate, endDate] = timeRange
    let filterIndex = 0

    // 1. 分区过滤（核心优化：toDate(分区字段) 与纯日期值比较，确保分区生效）
    const partitionField = this.PARTITION_FIELD
    const startKey = generatePlaceholderKey(partitionField, 'RANGE_START', filterIndex++)
    const endKey = generatePlaceholderKey(partitionField, 'RANGE_END', filterIndex++)
    const chType = 'Date' // 纯日期比较时，使用 ClickHouse 的 Date 类型（与分区键类型一致）
    whereParams[startKey] = startDate // 纯日期：YYYY-MM-DD
    whereParams[endKey] = endDate
    // 关键：toDate($service_time) 对齐分区键（假设分区键为 toDate($service_time)）
    clauses.push(
      `toDate(\`${partitionField}\`) BETWEEN {${startKey}: ${chType}} AND {${endKey}: ${chType}}`,
    )

    // 2. 事件名过滤
    const eventField = '$event_name'
    const validEventNames = eventInfoList
      .map(info => info.eventName!.trim())
      .filter(Boolean)
    if (validEventNames.length > 0) {
      const eventPlaceholders = validEventNames.map((name, idx) => {
        const key = generatePlaceholderKey(eventField, 'IN', idx)
        const chType = META_TYPE_TO_CH_TYPE[MetaPropertyType.STRING]
        whereParams[key] = name
        return `{${key}: ${chType}}`
      }).join(', ')
      clauses.push(`\`${eventField}\` IN (${eventPlaceholders})`)
    }

    // 3. 处理全局筛选条件
    globalFilters.forEach(filter => {
      const { propertyName, propertyType, propertyValue, compareType } = filter
      if (!this.isCompareTypeSupported(propertyType, compareType)) return

      const escapedField = this.escapeFieldName(propertyName)
      const { condition, params } = this.buildFilterCondition({
        field: propertyName,
        escapedField,
        propertyValue,
        compareType,
        propertyType,
        index: filterIndex++,
      })

      if (condition && params) {
        clauses.push(condition)
        Object.assign(whereParams, params)
      }
    })

    // 拼接 WHERE 子句
    const whereClause = clauses.length > 0
      ? `WHERE ${clauses[0]}${clauses.slice(1).map(cond => `\n  AND ${cond}`).join('')}`
      : ''

    return { whereClause, whereParams }
  }

  /**
   * 构建单个筛选条件
   */
  private buildFilterCondition({
    field,
    escapedField,
    propertyValue,
    compareType,
    propertyType,
    index,
  }: {
    field: string;
    escapedField: string;
    propertyValue: any;
    compareType: CompareType;
    propertyType: MetaPropertyType;
    index: number;
  }): { condition: string; params?: Record<string, string | number | boolean> } {
    const params: Record<string, string | number | boolean> = {}
    const validValues = Array.isArray(propertyValue)
      ? this.filterValidValues(propertyValue, propertyType)
      : this.filterValidValues([propertyValue], propertyType)

    if (validValues.length === 0) {
      console.warn(`【${propertyType}】字段 ${field} 的 ${compareType} 条件无有效值，忽略`)
      return { condition: '' }
    }

    const chType = META_TYPE_TO_CH_TYPE[propertyType]

    // 数组值（IN/NOT IN）
    if (Array.isArray(propertyValue)) {
      const placeholders = validValues.map((value, idx) => {
        const key = generatePlaceholderKey(field, 'CONTAINS_ITEM', index * 100 + idx)
        params[key] = this.formatValue(value, propertyType)
        return `{${key}: ${chType}}`
      }).join(', ')

      switch (compareType) {
        case 'EQUAL': return { condition: `${escapedField} IN (${placeholders})`, params }
        case 'NOT_EQUAL': return { condition: `${escapedField} NOT IN (${placeholders})`, params }
        case 'CONTAINS': return { condition: `${escapedField} IN (${placeholders})`, params }
        case 'NOT_CONTAINS': return { condition: `${escapedField} NOT IN (${placeholders})`, params }
        default: return { condition: '' }
      }
    }

    // RANGE 条件（日期类型特殊处理：纯日期比较）
    if (compareType === 'RANGE' && propertyType === MetaPropertyType.DATE) {
      if (!Array.isArray(validValues[0]) || validValues[0].length !== 2) {
        console.warn(`【DATE】字段 ${field} 的 RANGE 条件需传入长度为 2 的纯日期数组（如 ["2025-11-01", "2025-11-10"]）`)
        return { condition: '' }
      }
      const [startVal, endVal] = validValues[0]
      const startKey = generatePlaceholderKey(field, 'RANGE_START', index)
      const endKey = generatePlaceholderKey(field, 'RANGE_END', index)
      // 日期字段比较时，使用 toDate() 对齐纯日期值
      params[startKey] = this.formatValue(startVal, propertyType)
      params[endKey] = this.formatValue(endVal, propertyType)
      return {
        condition: `toDate(\`${escapedField}\`) BETWEEN {${startKey}: Date} AND {${endKey}: Date}`,
        params,
      }
    }

    // 其他类型 RANGE 条件
    if (compareType === 'RANGE' && [MetaPropertyType.NUMBER, MetaPropertyType.FLOAT].includes(propertyType)) {
      if (!Array.isArray(validValues[0]) || validValues[0].length !== 2) {
        console.warn(`【${propertyType}】字段 ${field} 的 RANGE 条件需传入长度为 2 的数组（如 [100, 200]）`)
        return { condition: '' }
      }
      const [startVal, endVal] = validValues[0]
      const startKey = generatePlaceholderKey(field, 'RANGE_START', index)
      const endKey = generatePlaceholderKey(field, 'RANGE_END', index)

      params[startKey] = this.formatValue(startVal, propertyType)
      params[endKey] = this.formatValue(endVal, propertyType)
      return {
        condition: `${escapedField} BETWEEN {${startKey}: ${chType}} AND {${endKey}: ${chType}}`,
        params,
      }
    }

    // 单个值条件（日期类型特殊处理：toDate() 对齐）
    if (propertyType === MetaPropertyType.DATE) {
      const value = validValues[0]
      const key = generatePlaceholderKey(field, compareType as ExtendedCompareType, index)
      params[key] = this.formatValue(value, propertyType)
      return {
        condition: `toDate(\`${escapedField}\`) ${this.getCompareOperator(compareType)} {${key}: Date}`,
        params,
      }
    }

    // 其他类型单个值条件
    const value = validValues[0]
    const key = generatePlaceholderKey(field, compareType as ExtendedCompareType, index)
    params[key] = this.formatValue(value, propertyType)
    return {
      condition: `${escapedField} ${this.getCompareOperator(compareType)} {${key}: ${chType}}`,
      params,
    }
  }

  /**
   * 格式化参数值（日期类型强制转为纯 YYYY-MM-DD）
   */
  private formatValue(value: any, propertyType: MetaPropertyType): string | number | boolean {
    switch (propertyType) {
      case MetaPropertyType.DATE:
        // 强制转为纯日期格式 YYYY-MM-DD
        const dateObj = typeof value === 'string' ? new Date(value) : value
        if (isNaN(dateObj.getTime())) {
          throw new Error(`无效日期：${value}，仅支持纯日期格式：YYYY-MM-DD`)
        }
        return dateObj.toISOString().split('T')[0] // 提取 YYYY-MM-DD
      case MetaPropertyType.BOOLEAN:
        return Boolean(value)
      case MetaPropertyType.NUMBER:
        return Number.isInteger(value) ? Number(value) : Math.floor(value)
      case MetaPropertyType.FLOAT:
        return Number(value)
      case MetaPropertyType.STRING:
        return String(value).trim()
      default:
        return String(value).trim()
    }
  }

  /**
   * 过滤无效值（日期类型仅保留纯 YYYY-MM-DD）
   */
  private filterValidValues(values: any[], propertyType: MetaPropertyType): any[] {
    return values.filter(val => {
      if (val === null || val === undefined || val === '') return false

      switch (propertyType) {
        case MetaPropertyType.STRING: return typeof val === 'string' && val.trim()
        case MetaPropertyType.NUMBER: return typeof val === 'number' && !isNaN(val)
        case MetaPropertyType.FLOAT: return typeof val === 'number' && !isNaN(val)
        case MetaPropertyType.BOOLEAN: return typeof val === 'boolean' || [0, 1].includes(val)
        case MetaPropertyType.DATE:
          // 仅允许纯日期格式 YYYY-MM-DD
          const dateObj = new Date(val)
          return !isNaN(dateObj.getTime()) && dateObj.toISOString().split('T')[0] === val
        default: return true
      }
    })
  }

  /**
   * 映射比较操作符（CompareType → SQL 操作符）
   */
  private getCompareOperator(compareType: CompareType): string {
    const operatorMap: Record<CompareType, string> = {
      EQUAL: '=',
      NOT_EQUAL: '!=',
      GREATER_THAN: '>',
      GREATER_THAN_OR_EQUAL: '>=',
      LESS_THAN: '<',
      LESS_THAN_OR_EQUAL: '<=',
      CONTAINS: 'IN',
      NOT_CONTAINS: 'NOT IN',
      REGEX: 'REGEXP',
      RANGE: 'BETWEEN',
    }
    return operatorMap[compareType]
  }

  /**
   * 校验操作符支持性
   */
  private isCompareTypeSupported(propertyType: MetaPropertyType, compareType: CompareType): boolean {
    const supportMap: Record<MetaPropertyType, CompareType[]> = {
      [MetaPropertyType.STRING]: ['EQUAL', 'NOT_EQUAL', 'CONTAINS', 'NOT_CONTAINS', 'REGEX'],
      [MetaPropertyType.NUMBER]: ['EQUAL', 'NOT_EQUAL', 'GREATER_THAN', 'GREATER_THAN_OR_EQUAL', 'LESS_THAN', 'LESS_THAN_OR_EQUAL', 'RANGE'],
      [MetaPropertyType.FLOAT]: ['EQUAL', 'NOT_EQUAL', 'GREATER_THAN', 'GREATER_THAN_OR_EQUAL', 'LESS_THAN', 'LESS_THAN_OR_EQUAL', 'RANGE'],
      [MetaPropertyType.BOOLEAN]: ['EQUAL', 'NOT_EQUAL'],
      [MetaPropertyType.DATE]: ['EQUAL', 'NOT_EQUAL', 'GREATER_THAN', 'GREATER_THAN_OR_EQUAL', 'LESS_THAN', 'LESS_THAN_OR_EQUAL', 'RANGE'],
    }
    const supported = supportMap[propertyType].includes(compareType)
    if (!supported) {
      console.warn(`【${propertyType}】不支持 ${compareType} 操作符，支持操作符：${supportMap[propertyType].join('、')}`)
    }
    return supported
  }

  /**
   * 字段名转义
   */
  private escapeFieldName(field: string): string {
    return `\`${field.replace(/`/g, '``')}\``
  }

  /**
   * 别名转义
   */
  private escapeAlias(alias: string): string {
    return alias.replace(/[^a-zA-Z0-9_]/g, '_')
  }

  /**
   * 构建 GROUP BY 子句（与分区键一致）
   */
  private buildGroupByClause(dimension: string[] = []): string {
    const uniqueDimensions = [...new Set(dimension)]
    const groupFields = [
      `toDate(\`${this.PARTITION_FIELD}\`)`, // 与分区键一致
      ...uniqueDimensions.map(field => this.escapeFieldName(field)),
    ].join(', ')
    return `GROUP BY ${groupFields}`
  }

  /**
   * 构建 ORDER BY 子句
   */
  private buildOrderByClause(dimension: string[] = []): string {
    const uniqueDimensions = [...new Set(dimension)]
    const orderFields = [
      `toDate(\`${this.PARTITION_FIELD}\`) ASC`,
      ...uniqueDimensions.map(field => `${this.escapeFieldName(field)} ASC`),
    ].join(', ')
    return `ORDER BY ${orderFields}`
  }
}

// 单例导出
export const eventAnalysisSqlBuilder = new EventAnalysisSqlBuilder()
