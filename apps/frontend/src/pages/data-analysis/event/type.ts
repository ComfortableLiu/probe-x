// url参数
export interface IQuery {
  // 事件部分
  eventInfoList: IEventInfo[]
  // 时间范围
  timeRange: [Date, Date]
  // 指标维度，属性
  dimension: string[]
  // 图表类型
  chartType: ChartType
}

// 事件列表
export interface IEventInfo {
  // 事件名
  eventName: string
  // 过滤条件
  filters: IAttributionFilter[]
  // 查看的数据指标
  metrics: Metrics
}

// 属性过滤条件
export interface IAttributionFilter {
  // 属性名
  propertyName: string
  // 属性值
  propertyValue: string[] | number[]
  // 比较方式
  compareType: CompareType
}


// 筛选条件类型
export enum CompareType {
  // 等于
  EQUAL = 'EQUAL',
  // 不等于
  NOT_EQUAL = 'NOT_EQUAL',
  // 大于
  GREATER_THAN = 'GREATER_THAN',
  // 大于等于
  GREATER_THAN_OR_EQUAL = 'GREATER_THAN_OR_EQUAL',
  // 小于
  LESS_THAN = 'LESS_THAN',
  // 小于等于
  LESS_THAN_OR_EQUAL = 'LESS_THAN_OR_EQUAL',
  // 区间
  RANGE = 'RANGE',
  // 包含
  CONTAINS = 'CONTAINS',
  // 不包含
  NOT_CONTAINS = 'NOT_CONTAINS',
  // 匹配正则
  REGEX = 'REGEX',
}

// 图表类型
export enum ChartType {
  // 折线图
  LINE = 'LINE',
  // 柱状图
  BAR = 'BAR',
  // 饼图
  PIE = 'PIE',
}

// 数据指标
export enum Metrics {
  // 数量
  COUNT = 'COUNT',
  // 用户数
  USERS = 'USERS',
  // 会话数
  SESSIONS = 'SESSIONS',
}
