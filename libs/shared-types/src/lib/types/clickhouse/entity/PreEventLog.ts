import { IEventLog } from "./EventLog"

// 一次补充后的事件
export interface IPreEventLog extends IEventLog {
  $spm_a: string
  $spm_b: string
  $spm_c: string
  $spm_d: string
  $spm_a_description: string
  $spm_b_description: string
  $spm_c_description: string
  $spm_d_description: string

  $scm_a: string
  $scm_b: string
  $scm_c: string
  $scm_d: string
  $scm_a_description: string
  $scm_b_description: string
  $scm_c_description: string
  $scm_d_description: string

  $session_id: string
}

// 创建event_log表的sql语句，与 scripts/init-clickhouse.sql 保持一致（按天分区 + 跳数索引）
export const createPreEventLogTableSQL = `
    create table probe_x.event_log
    (
        \`$event_id\`           String DEFAULT '' comment '事件唯一标识（SDK 生成的 uuid，端到端幂等去重键）',
        \`$event_name\`         LowCardinality(String) comment '事件名称（如 page_view, click, route_change）',
        \`$log_time\`           DateTime64(3) comment '客户端日志时间',
        \`$service_time\`       DateTime64(3) comment '服务端接收时间',
        \`$ip\`                 String DEFAULT '' comment '客户端 IP 地址',
        \`$web_site\`           LowCardinality(String) DEFAULT '' comment '网站域名',
        \`$web_pathname\`       LowCardinality(String) DEFAULT '' comment '页面路径',
        \`$web_params\`         String DEFAULT '' comment '页面参数',
        \`$page_id\`            String DEFAULT '' comment '页面唯一标识',
        \`$source_page_id\`     String DEFAULT '' comment '来源页面标识',
        \`$target_page_id\`     String DEFAULT '' comment '目标页面标识（路由跳转时）',
        \`$device_id\`          String DEFAULT '' comment '设备唯一标识',
        \`$uid\`                UInt64 DEFAULT 0 comment '用户ID',
        \`$device\`             LowCardinality(String) DEFAULT '' comment '设备类型（desktop/mobile/tablet）',
        \`$language\`           LowCardinality(String) DEFAULT '' comment '浏览器语言',
        \`$ua\`                 String DEFAULT '' comment 'User-Agent',
        \`$screen_width\`       UInt32 DEFAULT 0 comment '屏幕宽度（像素）',
        \`$screen_height\`      UInt32 DEFAULT 0 comment '屏幕高度（像素）',
        \`$viewport_width\`     UInt32 DEFAULT 0 comment '视口宽度',
        \`$viewport_height\`    UInt32 DEFAULT 0 comment '视口高度',
        \`$device_pixel_ratio\` Float32 DEFAULT 1 comment '设备像素比（如 Retina 屏为 2）',
        \`$scroll_height\`      UInt32 DEFAULT 0 comment '页面滚动高度',
        \`$utm_source\`         String DEFAULT '' comment 'UTM 来源',
        \`$utm_campaign\`       String DEFAULT '' comment 'UTM 活动',
        \`$utm_medium\`         String DEFAULT '' comment 'UTM 媒介',
        \`$utm_content\`        String DEFAULT '' comment 'UTM 内容',
        \`$utm_term\`           String DEFAULT '' comment 'UTM 关键词',
        \`$referrer\`           String DEFAULT '' comment '页面来源',
        \`$zoon\`               Int8 DEFAULT 8 comment '时区偏移',
        \`$element_id\`         String DEFAULT '' comment '触发事件的元素ID',
        \`$spm\`                String DEFAULT '' comment 'SPM 完整编码',
        \`$spm_a\`              LowCardinality(String) DEFAULT '' comment 'SPM 第一层',
        \`$spm_b\`              LowCardinality(String) DEFAULT '' comment 'SPM 第二层',
        \`$spm_c\`              String DEFAULT '' comment 'SPM 第三层',
        \`$spm_d\`              String DEFAULT '' comment 'SPM 第四层',
        \`$spm_a_description\`  String DEFAULT '' comment 'SPM 第一层描述',
        \`$spm_b_description\`  String DEFAULT '' comment 'SPM 第二层描述',
        \`$spm_c_description\`  String DEFAULT '' comment 'SPM 第三层描述',
        \`$spm_d_description\`  String DEFAULT '' comment 'SPM 第四层描述',
        \`$scm\`                String DEFAULT '' comment 'SCM 完整编码',
        \`$scm_a\`              LowCardinality(String) DEFAULT '' comment 'SCM 第一层',
        \`$scm_b\`              LowCardinality(String) DEFAULT '' comment 'SCM 第二层',
        \`$scm_c\`              String DEFAULT '' comment 'SCM 第三层',
        \`$scm_d\`              String DEFAULT '' comment 'SCM 第四层',
        \`$scm_a_description\`  String DEFAULT '' comment 'SCM 第一层描述',
        \`$scm_b_description\`  String DEFAULT '' comment 'SCM 第二层描述',
        \`$scm_c_description\`  String DEFAULT '' comment 'SCM 第三层描述',
        \`$scm_d_description\`  String DEFAULT '' comment 'SCM 第四层描述',
        \`$session_id\`         String DEFAULT '' comment '会话唯一标识',
        \`$is_attribution_event\` Bool DEFAULT false comment '是否是归因事件',
        \`$ex_attribution_params\` String DEFAULT '' comment '扩展归因参数（JSON格式）',
        INDEX idx_event_name \`$event_name\` TYPE set(100) GRANULARITY 1,
        INDEX idx_session_id \`$session_id\` TYPE bloom_filter GRANULARITY 1,
        INDEX idx_device_id \`$device_id\` TYPE bloom_filter GRANULARITY 1,
        INDEX idx_page_id \`$page_id\` TYPE bloom_filter GRANULARITY 1
    )
        engine = MergeTree PARTITION BY toDate(\`$service_time\`)
            ORDER BY (\`$service_time\`, \`$session_id\`, \`$event_name\`)
            TTL \`$service_time\` + INTERVAL 365 DAY
            SETTINGS index_granularity = 8192
`
