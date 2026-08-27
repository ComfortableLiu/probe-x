/* eslint-disable */
import { generateEventAnalysisSql } from "@src/api/data-analysis/EventAnalysisSqlBuilder"

const fmt = (d: Date) => d.toISOString().slice(0, 10)
const today = new Date()
const req: any = {
  timeRange: [fmt(new Date(today.getTime() - 6 * 86400000)), fmt(today)],
  eventInfoList: [{ eventName: 'page_view', metrics: 'COUNT' }],
  dimension: [''],
  globalFilters: [],
}
const { sql, params, error } = generateEventAnalysisSql(req)
console.log('ERROR:', error)
console.log('SQL:\n' + sql)
console.log('PARAMS:', JSON.stringify(params, null, 1))
