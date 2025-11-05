export interface IAttribution {
  // 关联的页面 id，这里的是上个页面，而不是当前页面，所以读取的时候需要使用 $source_page_id
  source_page_id: string
  // 索引，可以理解为数组下标
  attribution_index: number
  // 归因属性名
  attr_key: string
  // 归因属性值
  attr_value: string
  // 事件时间，与主表保持一致，为了分区
  event_time: Date
}

// 创建归因子表
export const createEventAttributionTableSQL = `
    CREATE TABLE probe_x.event_attribution
    (
        source_page_id    String comment '关联的页面 id，这里的是上个页面，而不是当前页面，对应 probe_x.final_event_log.$source_page_id',
        attribution_index UInt8 comment '归因项在列表中的索引（区分同事件的不同归因）',
        attr_key          LowCardinality(String) comment '归因属性名（如“归因属性1”，低基数优化）',
        attr_value        String comment '归因属性值',
        event_time        DateTime64(3) comment '与主表时间一致，用于分区对齐，对应 probe_x.final_event_log.$service_time'
    ) ENGINE = MergeTree()
          PARTITION BY toDate(event_time)
          ORDER BY (attr_key, attr_value, source_page_id, attribution_index)
          SETTINGS index_granularity = 8192
          COMMENT '事件归因KV子表（动态归因属性存储）';
`
