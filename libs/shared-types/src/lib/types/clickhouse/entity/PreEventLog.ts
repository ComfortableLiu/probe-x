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

// 创建event_log表的sql语句，仅包含公参
export const createPreEventLogTableSQL = `
    create table probe_x.event_log
    (
        \`$event_name\`         LowCardinality(String) comment '事件名',
        \`$log_time\`           DateTime64(3) comment '用户事件产生的时间',
        \`$service_time\`       DateTime64(3) comment '服务器收到的时间',
        \`$ip\`                 String comment 'ip地址',
        \`$web_site\`           LowCardinality(String) comment '页面站点',
        \`$web_pathname\`       LowCardinality(String) comment '页面pathname',
        \`$web_params\`         String comment '页面参数',
        \`$device_id\`          String comment '设备id',
        \`$uid\`                Int64 comment '用户id',
        \`$utm_source\`         String comment '流量来源',
        \`$utm_campaign\`       String comment '营销活动名称',
        \`$utm_medium\`         String comment '流量类型/媒介',
        \`$utm_content\`        String comment '广告主题内容',
        \`$utm_term\`           String comment '搜索广告关键词',
        \`$referrer\`           String comment '上一个来源页面',
        \`$zoon\`               Int32 comment '时区偏移量',
        \`$device\`             LowCardinality(String) comment '设备类型',
        \`$language\`           LowCardinality(String) comment '用户当前语言',
        \`$ua\`                 String comment '浏览器 User-Agent',
        \`$screen_width\`       Int32 comment '屏幕宽度（像素）',
        \`$screen_height\`      Int32 comment '屏幕高度（像素）',
        \`$viewport_width\`     Int32 comment '可视窗口宽度',
        \`$viewport_height\`    Int32 comment '可视窗口高度',
        \`$device_pixel_ratio\` Float64 comment '设备像素比（如 Retina 屏为 2）',
        \`$scroll_height\`      Int32 comment '页面滚动高度（用户浏览深度）',
        \`$element_id\`         String comment '触发事件的前端元素选择器',
        \`$page_id\`            String comment '当前页面id',
        \`$source_page_id\`     String comment '上一个页面的id',
        \`$spm\`                String comment 'SPM信息',
        \`$scm\`                String comment 'SCM信息',
        \`$spm_a\`              LowCardinality(String) comment 'SPM位置信息A段',
        \`$spm_b\`              LowCardinality(String) comment 'SPM位置信息B段',
        \`$spm_c\`              String comment 'SPM位置信息C段',
        \`$spm_d\`              String comment 'SPM位置信息D段',
        \`$spm_a_description\`  String comment 'SPM位置信息A段详情',
        \`$spm_b_description\`  String comment 'SPM位置信息B段详情',
        \`$spm_c_description\`  String comment 'SPM位置信息C段详情',
        \`$spm_d_description\`  String comment 'SPM位置信息D段详情',
        \`$scm_a\`              LowCardinality(String) comment 'SCM位置信息A段',
        \`$scm_b\`              LowCardinality(String) comment 'SCM位置信息B段',
        \`$scm_c\`              String comment 'SCM位置信息C段',
        \`$scm_d\`              String comment 'SCM位置信息D段',
        \`$scm_a_description\`  String comment 'SCM位置信息A段详情',
        \`$scm_b_description\`  String comment 'SCM位置信息B段详情',
        \`$scm_c_description\`  String comment 'SCM位置信息C段详情',
        \`$scm_d_description\`  String comment 'SCM位置信息D段详情',
        \`$session_id\`         String comment '会话ID'
    )
        engine = ReplacingMergeTree PARTITION BY toDate(\`$service_time\`)
            ORDER BY (\`$service_time\`, \`$log_time\`)
            SETTINGS index_granularity = 8192
            comment '原始用户数据表';
`
