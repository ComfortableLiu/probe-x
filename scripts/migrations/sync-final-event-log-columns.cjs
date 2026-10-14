#!/usr/bin/env node
// 同步 final_event_log 缺失的列：以 event_log 为准，只增不删。
// 业务属性（property.service.ts createProperty）历史上只对 event_log 执行过 ADD COLUMN，
// 本脚本为存量环境补齐 final_event_log 的列，避免清洗服务写入时报未知列。
// 配置来自环境变量：CLICKHOUSE_HOST（默认 localhost）、CLICKHOUSE_HTTP_PORT（默认 8123）、
// CLICKHOUSE_USER、CLICKHOUSE_PASSWORD、CLICKHOUSE_DATABASE（默认 probe_x）。
const { createClient } = require('@clickhouse/client')

const config = {
  host: process.env.CLICKHOUSE_HOST || 'localhost',
  port: parseInt(process.env.CLICKHOUSE_HTTP_PORT || '', 10) || 8123,
  username: process.env.CLICKHOUSE_USER || 'default',
  password: process.env.CLICKHOUSE_PASSWORD || '',
  database: process.env.CLICKHOUSE_DATABASE || 'probe_x',
}

const client = createClient({
  url: `http://${config.host}:${config.port}`,
  username: config.username,
  password: config.password,
  database: config.database,
})

function escapeComment(comment) {
  return (comment || '').replace(/'/g, "\\'")
}

async function getColumns(table) {
  const result = await client.query({
    query: `
      SELECT name, type, comment
      FROM system.columns
      WHERE database = {database:String}
        AND table = {table:String}
      ORDER BY position
    `,
    query_params: { database: config.database, table },
    format: 'JSONEachRow',
  })
  return result.json()
}

async function main() {
  console.log(`[sync-final-event-log-columns] 连接 ClickHouse http://${config.host}:${config.port}，数据库 ${config.database}`)
  const [eventColumns, finalColumns] = await Promise.all([getColumns('event_log'), getColumns('final_event_log')])
  console.log(`[sync-final-event-log-columns] event_log 共 ${eventColumns.length} 列，final_event_log 共 ${finalColumns.length} 列`)
  const existing = new Set(finalColumns.map(column => column.name))
  const missing = eventColumns.filter(column => !existing.has(column.name))
  if (missing.length === 0) {
    console.log('[sync-final-event-log-columns] final_event_log 无缺失列，无需同步')
    return
  }
  console.log(`[sync-final-event-log-columns] final_event_log 缺失 ${missing.length} 列：${missing.map(column => column.name).join(', ')}`)
  for (const column of missing) {
    const ddl = `ALTER TABLE \`final_event_log\` ADD COLUMN IF NOT EXISTS \`${column.name}\` ${column.type} COMMENT '${escapeComment(column.comment)}'`
    console.log(`[sync-final-event-log-columns] 执行：${ddl}`)
    await client.command({ query: ddl })
    console.log(`[sync-final-event-log-columns] 已添加列 ${column.name}`)
  }
  console.log('[sync-final-event-log-columns] 同步完成')
}

main()
  .catch(error => {
    console.error(`[sync-final-event-log-columns] 同步失败：${error.message}`)
    process.exitCode = 1
  })
  .finally(() => client.close())
