export interface IEvent extends IEventBase {
  // 其他业务属性
  [key: string]: any
}

// 数据库公共属性字段
export interface IEventBase {
  // 事件名称
  $event_name: string
  // IP地址
  $ip: string
  // User Agent字符串
  $ua: string
  // 设备ID
  $device_id: string
  // 来源页面
  $referrer: string
  // UTM来源
  $utm_source: string
  // UTM媒介
  $utm_medium: string
  // UTM活动
  $utm_campaign: string
  // UTM关键词
  $utm_term: string
  // UTM内容
  $utm_content: string
  // 日志记录时间，用户本地的时间
  $log_time: Date
  // 服务端处理时间，服务器处理的时间
  $service_time: Date
  // 网站域名
  $web_site: string
  // 页面路径
  $web_pathname: string
  // 页面参数
  $web_params: string
  // 用户ID
  $uid: number
  // 时区偏移量，毫秒
  $zoon: number
  // 设备类型
  $device: string
  // 语言
  $language: string
  // 屏幕宽度
  $screen_width: number
  // 屏幕高度
  $screen_height: number
  // 视口宽度
  $viewport_width: number
  // 视口高度
  $viewport_height: number
  // 设备像素比
  $device_pixel_ratio: number
  // 页面滚动高度（用户浏览深度）
  $scroll_height: number
  // 触发事件的前端元素选择器
  $element_id: string
}

// 创建event_log表的sql语句，仅包含公参
export const createEventLogTableSQL = `
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
        \`$element_id\`         String comment '触发事件的前端元素选择器'
    )
        engine = ReplacingMergeTree PARTITION BY toDate(\`$service_time\`)
            ORDER BY (\`$service_time\`, \`$log_time\`)
            SETTINGS index_granularity = 8192
            comment '原始用户数据表';
`
