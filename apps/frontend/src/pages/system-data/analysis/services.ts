import request from '@/lib/request'

// 获取数据分析统计信息
export async function getAnalysisStatistics(date?: string) {
  return request({
    url: '/system-data/analysis/statistics',
    method: 'get',
    params: {
      date,
    },
  })
}

// 获取数据分析趋势
export async function getAnalysisTrend(days?: number, startDate?: string, endDate?: string) {
  return request({
    url: '/system-data/analysis/trend',
    method: 'get',
    params: {
      days,
      startDate,
      endDate,
    },
  })
}

// 获取数据分析任务列表
export async function getAnalysisTasks(page: number = 1, pageSize: number = 10, status?: number) {
  return request({
    url: '/system-data/analysis/tasks',
    method: 'get',
    params: {
      page,
      pageSize,
      status,
    },
  })
}

// 获取小时级数据分析趋势
export async function getHourlyAnalysisTrend(date?: string) {
  return request({
    url: '/system-data/analysis/hourly-trend',
    method: 'get',
    params: {
      date,
    },
  })
}