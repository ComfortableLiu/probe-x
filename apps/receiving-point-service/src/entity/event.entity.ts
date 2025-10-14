export interface IEvent {
  // 事件ID，可选
  id?: number
  // 事件名称
  eventName: string
  // IP地址
  ip: string
  // User Agent字符串
  ua: string
  // 设备ID
  deviceId: string
  // 来源页面
  referrer: string
  // UTM来源
  utmSource: string
  // UTM媒介
  utmMedium: string
  // UTM活动
  utmCampaign: string
  // UTM关键词
  utmTerm: string
  // UTM内容
  utmContent: string
  // 日志记录时间，用户本地的时间
  logTime: Date
  // 服务端处理时间，服务器处理的时间
  serviceTime: Date
  // 网站域名
  webSite: string
  // 页面路径
  webPathname: string
  // 页面参数
  webParams: string
  // 用户ID
  uid: number
  // 时区偏移量，毫秒
  zoon: number
  // 设备类型
  device: string
  // 语言
  language: string
  // 屏幕宽度
  screenWidth: number
  // 屏幕高度
  screenHeight: number
  // 视口宽度
  viewportWidth: number
  // 视口高度
  viewportHeight: number
  // 设备像素比
  devicePixelRatio: number
  // 页面滚动高度（用户浏览深度）
  scrollHeight: number
  // 触发事件的前端元素选择器
  elementId?: string

  // 其他业务属性
  [key: string]: any
}
// 创建event表的sql语句
export const createEventTableSQL = `
    CREATE TABLE IF NOT EXISTS event
    (
        \`$id\`                 UInt64,
        \`$event_name\`         LowCardinality(String),
        \`$ip\`                 String,
        \`$ua\`                 String,
        \`$device_id\`          String,
        \`$referrer\`           String,
        \`$utm_source\`         String,
        \`$utm_medium\`         String,
        \`$utm_campaign\`       String,
        \`$utm_term\`           String,
        \`$utm_content\`        String,
        \`$log_time\`           DateTime64(3, 'UTC'),
        \`$service_time\`       DateTime64(3, 'UTC'),
        \`$web_site\`           LowCardinality(String),
        \`$web_pathname\`       LowCardinality(String),
        \`$web_params\`         String,
        \`$uid\`                UInt64,
        \`$zoon\`               Decimal(5, 2),
        \`$device\`             LowCardinality(String),
        \`$language\`           LowCardinality(String),
        \`$screen_width\`       UInt32,
        \`$screen_height\`      UInt32,
        \`$viewport_width\`     UInt32,
        \`$viewport_height\`    UInt32,
        \`$device_pixel_ratio\` Decimal(5, 2),
        \`$scroll_height\`      UInt32,
        \`$element_id\`         String
    )
        ENGINE = MergeTree()
            PARTITION BY toYYYYMM(\`$service_time\`)
            ORDER BY (\`$log_time\`, \`$service_time\`, \`$uid\`, \`$device_id\`)
            SETTINGS index_granularity = 8192
`
