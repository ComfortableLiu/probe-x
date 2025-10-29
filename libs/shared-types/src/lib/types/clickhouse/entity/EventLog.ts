// 原始事件
export interface IEventLog extends IEventBase {
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
  $spm: string
  $scm: string
}
