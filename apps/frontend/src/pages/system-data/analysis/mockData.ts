// 统计数据
export const mockStatistics = [
  { title: '查询次数', value: 1285, icon: 'bar-chart', color: '#7b68ee' },
  { title: '查询人数', value: 342, icon: 'user-group', color: '#40e0d0' },
  { title: '查询平均耗时', value: '1.2s', icon: 'clock-circle', color: '#ff6347' },
  { title: '查询失败率', value: '0.8%', icon: 'close-circle', color: '#ff4500' },
  { title: '正在排队中任务数', value: 12, icon: 'hourglass', color: '#ffa500' },
  { title: '计算中的任务数', value: 24, icon: 'desktop', color: '#32cd32' },
  { title: '已终止的任务数', value: 3, icon: 'stop', color: '#808080' },
  { title: '导出数据次数', value: 56, icon: 'download', color: '#9370db' },
  { title: '导出数据人数', value: 32, icon: 'user-group', color: '#20b2aa' },
]

// 24小时内分任务查看次数、人数图表数据
export const mockHourlyChartData = {
  hours: Array.from({ length: 24 }, (_, i) => `${i}:00`),
  queryCounts: Array.from({ length: 24 }, () => Math.floor(Math.random() * 100)),
  userCounts: Array.from({ length: 24 }, () => Math.floor(Math.random() * 50)),
}

// 每天分任务查看次数、人数图表数据
export const mockDailyChartData = {
  dates: Array.from({ length: 30 }, (_, i) => `12-${i + 1}`),
  queryCounts: Array.from({ length: 30 }, () => Math.floor(Math.random() * 500)),
  userCounts: Array.from({ length: 30 }, () => Math.floor(Math.random() * 200)),
}

// 任务列表数据
export const mockTaskData = [
  {
    key: '1',
    taskName: '用户行为分析报告',
    initiator: '张三',
    status: '已完成',
    startTime: '2025-12-01 09:30:22',
    endTime: '2025-12-01 09:35:45',
    duration: '5分23秒',
  },
  {
    key: '2',
    taskName: '销售数据统计',
    initiator: '李四',
    status: '计算中',
    startTime: '2025-12-01 10:15:30',
    endTime: '-',
    duration: '进行中',
  },
  {
    key: '3',
    taskName: '产品访问趋势',
    initiator: '王五',
    status: '已终止',
    startTime: '2025-12-01 11:20:10',
    endTime: '2025-12-01 11:25:05',
    duration: '已终止',
  },
  {
    key: '4',
    taskName: '用户画像分析',
    initiator: '赵六',
    status: '已完成',
    startTime: '2025-12-02 14:20:15',
    endTime: '2025-12-02 14:35:30',
    duration: '15分15秒',
  },
  {
    key: '5',
    taskName: '流量来源分析',
    initiator: '钱七',
    status: '排队中',
    startTime: '2025-12-03 08:45:10',
    endTime: '-',
    duration: '等待中',
  },
  {
    key: '6',
    taskName: '转化漏斗分析',
    initiator: '孙八',
    status: '已完成',
    startTime: '2025-12-03 16:30:00',
    endTime: '2025-12-03 16:42:45',
    duration: '12分45秒',
  },
]
