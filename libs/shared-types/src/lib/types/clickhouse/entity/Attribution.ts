export interface IAttribution {
  // 归因事件的 $event_id，用于与 final_event_log 精确关联
  event_id: string
  // 会话唯一标识，对应 final_event_log.$session_id
  session_id: string
  // 归因属性名（camelCase，保留 $ 前缀）
  attr_key: string
  // 归因属性值
  attr_value: string
  // 归因事件的 $service_time，用于分区对齐
  event_time: Date
}

// 创建归因子表，与 scripts/init-clickhouse.sql 保持一致
// 只存归因事件（final_event_log.$is_attribution_event = true）的扩展归因参数
// （$ex_attribution_params 解析后的键值对）；SPM/SCM 标准字段已是 final_event_log 的列，
// 不再写入本表。查询侧按 event_id 关联后，按 session 内时间前缀动态拼装归因链
export const createEventAttributionTableSQL = `
    CREATE TABLE probe_x.event_attribution
    (
        \`event_id\`   String comment '归因事件的 $event_id，用于与 final_event_log 精确关联',
        \`session_id\` String comment '会话唯一标识，对应 final_event_log.$session_id',
        \`attr_key\`   LowCardinality(String) comment '归因属性名（camelCase，保留 $ 前缀）',
        \`attr_value\` String comment '归因属性值',
        \`event_time\` DateTime64(3) comment '归因事件的 $service_time，用于分区对齐，对应 final_event_log.$service_time'
    ) ENGINE = MergeTree()
          PARTITION BY toDate(event_time)
          ORDER BY (session_id, event_time, attr_key)
          TTL event_time + INTERVAL 730 DAY
          SETTINGS index_granularity = 8192
          COMMENT '事件归因KV子表（动态归因属性存储）';
`
