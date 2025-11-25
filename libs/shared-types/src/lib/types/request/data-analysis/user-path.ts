// 用户路径分析请求入参
export interface IUserPathAnalysisReq {
  // 需要分析的事件列表
  eventList: string[];
  // 开始事件
  startEvent?: string;
  // 结束事件
  endEvent?: string;
  // 窗口期
  windowPeriod: {
    // 数字
    value: number
    // 单位
    unit: 'm' | 'h' | 'd'
  }
  // 时间范围
  timeRange: [`${string}-${string}-${string}`, `${string}-${string}-${string}`]
}

// 用户路径分析请求返回值
export interface IUserPathAnalysisRes {
  // 事件列表
  eventList: string[];
  // 边表
  edgeList: {
    source: string
    target: string
    value: number
  }[]
}
