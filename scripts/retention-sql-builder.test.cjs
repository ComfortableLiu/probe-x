/**
 * 留存分析 SQL 构建器测试
 * 运行方式：node scripts/retention-sql-builder.test.cjs
 */
const assert = require('node:assert/strict')
const { execSync } = require('node:child_process')
const { mkdirSync } = require('node:fs')
const { resolve } = require('node:path')

const rootDir = resolve(__dirname, '..')
const entryFile = 'apps/data-dashboard-api-service/src/api/data-analysis/RetentionAnalysisSqlBuilder.ts'
const bundleFile = resolve(rootDir, 'tmp/.retention-sql-builder.bundle.cjs')

// 先用 esbuild 把 TS 源码打成 cjs bundle（@src/* 路径别名依赖服务的 tsconfig）
mkdirSync(resolve(rootDir, 'tmp'), { recursive: true })
execSync(
  `npx esbuild ${entryFile} --bundle --platform=node --format=cjs --tsconfig=apps/data-dashboard-api-service/tsconfig.json --outfile=tmp/.retention-sql-builder.bundle.cjs`,
  { cwd: rootDir, stdio: 'inherit' },
)
const { generateRetentionAnalysisSql } = require(bundleFile)

const baseReq = {
  startEvent: { eventName: 'page_view' },
  returnEvent: { eventName: 'page_click' },
  timeRange: ['2026-10-01', '2026-10-07'],
  retentionWindows: [1],
  granularity: 'DAY',
}

/** 最终 SELECT 的输出列列表（FROM retention_data 之前的片段） */
function finalSelectOf(sql) {
  return sql.slice(sql.lastIndexOf('\nSELECT'), sql.indexOf('FROM retention_data'))
}

/** params 中所有留存窗口参数的值（按插入序，即窗口升序） */
function windowParamValuesOf(params) {
  return Object.entries(params).filter(([key]) => key.includes('window_')).map(([, value]) => value)
}

let passed = 0
function runCase(name, fn) {
  fn()
  passed++
  console.log(`✓ ${name}`)
}

runCase('缺少必填参数时返回 error 且 sql 为空', () => {
  const cases = [
    ['startEvent.eventName', { ...baseReq, startEvent: {} }],
    ['returnEvent.eventName', { ...baseReq, returnEvent: {} }],
    ['timeRange', { ...baseReq, timeRange: undefined }],
    ['retentionWindows', { ...baseReq, retentionWindows: undefined }],
    ['retentionWindows 为空数组', { ...baseReq, retentionWindows: [] }],
  ]
  for (const [field, req] of cases) {
    const result = generateRetentionAnalysisSql(req)
    assert.ok(result.error, `缺少 ${field} 应返回 error`)
    assert.equal(result.sql, '', `缺少 ${field} 时 sql 应为空`)
  }
})

runCase('正常请求：$log_time 时间字段、特定日期留存口径、窗口乱序输入后输出升序', () => {
  const result = generateRetentionAnalysisSql({ ...baseReq, retentionWindows: [7, 1, 3] })
  assert.equal(result.error, undefined)
  assert.ok(!result.sql.includes('$service_time'), 'SQL 不应使用 $service_time')
  assert.ok(result.sql.includes('`$log_time`'), 'SQL 应统一使用 $log_time')
  assert.ok(
    result.sql.includes('return_period = cohort_users.cohort_date + INTERVAL'),
    '应为特定日期留存口径：回访所属周期恰好等于队列周期 + N 个粒度单位',
  )
  assert.ok(/INTERVAL \{param_window_1d_\d+:Int64\} DAY/.test(result.sql), 'DAY 粒度窗口单位应为 DAY')
  assert.ok(result.sql.includes('return_period >= cohort_users.cohort_date'), '应含回访周期下界')
  assert.ok(result.sql.includes("concat('d_'"), '匿名用户应回退到 $device_id 实体')

  // 最终 SELECT 的输出列按窗口升序排列
  const finalSelect = finalSelectOf(result.sql)
  const orderedColumns = [
    'retention_users_1d', 'retention_rate_1d',
    'retention_users_3d', 'retention_rate_3d',
    'retention_users_7d', 'retention_rate_7d',
  ]
  let lastIndex = -1
  for (const column of orderedColumns) {
    const index = finalSelect.indexOf(column)
    assert.ok(index > lastIndex, `最终 SELECT 中 ${column} 应按窗口升序排在前一列之后`)
    lastIndex = index
  }
  assert.deepEqual(windowParamValuesOf(result.params), [1, 3, 7], '窗口参数值应为升序的 1/3/7')
})

runCase('维度字段：单分组口径（argMin 取首个起始事件属性值）且回访侧不做属性关联', () => {
  const result = generateRetentionAnalysisSql({ ...baseReq, dimension: ['$zoon'] })
  assert.equal(result.error, undefined)
  assert.ok(finalSelectOf(result.sql).includes('`$zoon`'), '最终 SELECT 应包含 `$zoon` 维度列')
  const retentionData = result.sql.slice(result.sql.indexOf('retention_data AS ('), result.sql.lastIndexOf('\nSELECT'))
  assert.ok(retentionData.includes('AS `$zoon`'), 'retention_data CTE 应包含 AS `$zoon` 别名')
  assert.ok(
    result.sql.includes('argMin(`$zoon`, `$log_time`)'),
    'cohort_users 应以 argMin 取队列周期内首个起始事件的属性值（单分组口径）',
  )
  const returnEvents = result.sql.slice(result.sql.indexOf('return_events AS ('), result.sql.indexOf('retention_data AS ('))
  assert.ok(!returnEvents.includes('$zoon'), '未开启关联属性时回访侧不应按维度关联')
})

runCase('WEEK / MONTH 粒度分别使用 toMonday / toStartOfMonth 截断，窗口单位跟随粒度', () => {
  const week = generateRetentionAnalysisSql({ ...baseReq, granularity: 'WEEK' })
  assert.ok(week.sql.includes('toMonday(`$log_time`)'), 'WEEK 粒度应使用 toMonday')
  assert.ok(/INTERVAL \{param_window_1d_\d+:Int64\} WEEK/.test(week.sql), 'WEEK 粒度窗口单位应为 WEEK')
  assert.ok(week.sql.includes('date_add(WEEK,'), 'WEEK 粒度扩展范围应按周延展')
  const month = generateRetentionAnalysisSql({ ...baseReq, granularity: 'MONTH' })
  assert.ok(month.sql.includes('toStartOfMonth(`$log_time`)'), 'MONTH 粒度应使用 toStartOfMonth')
  assert.ok(/INTERVAL \{param_window_1d_\d+:Int64\} MONTH/.test(month.sql), 'MONTH 粒度窗口单位应为 MONTH')
  assert.ok(month.sql.includes('date_add(MONTH,'), 'MONTH 粒度扩展范围应按月延展')
})

runCase('非法留存窗口被过滤，全部非法时返回 error', () => {
  const mixed = generateRetentionAnalysisSql({ ...baseReq, retentionWindows: [0, -1, 400, 1.5, 2] })
  assert.equal(mixed.error, undefined)
  assert.ok(mixed.sql.includes('retention_users_2d'), '合法窗口 2 应保留')
  for (const filtered of ['retention_users_0d', 'retention_users_400d']) {
    assert.ok(!mixed.sql.includes(filtered), `非法窗口列 ${filtered} 应被过滤`)
  }
  assert.deepEqual(windowParamValuesOf(mixed.params), [2], '窗口参数应只剩合法值 2')

  const allInvalid = generateRetentionAnalysisSql({ ...baseReq, retentionWindows: [0, -1, 400, 1.5] })
  assert.ok(allInvalid.error, '全部窗口非法时应返回 error')
  assert.equal(allInvalid.sql, '', '全部窗口非法时 sql 应为空')
})

console.log(`\n留存分析 SQL 构建器全部 ${passed} 个用例通过`)
