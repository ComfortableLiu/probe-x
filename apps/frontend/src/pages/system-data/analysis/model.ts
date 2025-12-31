import { createModel } from "@rematch/core"
import { RootModel } from "@/store/models"
import { ISystemDataAnalysisState } from "./type"
import { getAnalysisStatistics, getAnalysisTrend, getAnalysisTasks, getHourlyAnalysisTrend } from './services'

const initState: ISystemDataAnalysisState = {
  statistics: {
    queryCount: 0,
    userCount: 0,
    avgDuration: '0ms',
    failureRate: '0%',
    queuedTasks: 0,
    processingTasks: 0,
    terminatedTasks: 0,
    exportCount: 0,
    exportUserCount: 0,
  },
  hourlyChartData: {
    hours: Array.from({ length: 24 }, (_, i) => `${i}:00`),
    queryCounts: Array(24).fill(0),
    userCounts: Array(24).fill(0),
  },
  dailyChartData: {
    dates: [],
    queryCounts: [],
    userCounts: [],
  },
  taskList: [],
  total: 0,
  page: 1,
  pageSize: 10,
}

const analysisModel = createModel<RootModel>()({
  name: 'systemDataAnalysisModel',
  state: initState,
  reducers: {
    updateItem(state, payload) {
      return {
        ...state,
        ...payload,
      }
    },
    updateStatistics(state, payload) {
      return {
        ...state,
        statistics: {
          ...state.statistics,
          ...payload,
        },
      }
    },
    updateHourlyChartData(state, payload) {
      return {
        ...state,
        hourlyChartData: {
          ...state.hourlyChartData,
          ...payload,
        },
      }
    },
    updateDailyChartData(state, payload) {
      return {
        ...state,
        dailyChartData: {
          ...state.dailyChartData,
          ...payload,
        },
      }
    },
    updateTaskList(state, payload) {
      return {
        ...state,
        taskList: payload.data || [],
        total: payload.total || 0,
        page: payload.page || 1,
        pageSize: payload.pageSize || 10,
      }
    },
  },
  effects: (dispatch) => ({
    // 获取数据分析统计信息
    async getAnalysisStatistics(payload: { date?: string }, rootState) {
      try {
        const { date } = payload || {}
        const response = await getAnalysisStatistics(date)
        dispatch.systemDataAnalysisModel.updateStatistics(response.data)
        return response.data
      } catch (error) {
        console.error('Failed to get analysis statistics:', error)
        throw error
      }
    },
    // 获取数据分析趋势
    async getAnalysisTrend(payload: { days?: number, startDate?: string, endDate?: string }, rootState) {
      try {
        const { days, startDate, endDate } = payload || {}
        const response = await getAnalysisTrend(days, startDate, endDate)
        dispatch.systemDataAnalysisModel.updateDailyChartData(response.data)
        return response.data
      } catch (error) {
        console.error('Failed to get analysis trend:', error)
        throw error
      }
    },
    // 获取数据分析任务列表
    async getAnalysisTasks(payload: { page?: number, pageSize?: number, status?: number }, rootState) {
      try {
        const { page = 1, pageSize = 10, status } = payload || {}
        const response = await getAnalysisTasks(page, pageSize, status)
        dispatch.systemDataAnalysisModel.updateTaskList(response.data)
        return response.data
      } catch (error) {
        console.error('Failed to get analysis tasks:', error)
        throw error
      }
    },
    // 获取小时级数据分析趋势
    async getHourlyAnalysisTrend(payload: { date?: string }, rootState) {
      try {
        const { date } = payload || {}
        const response = await getHourlyAnalysisTrend(date)
        dispatch.systemDataAnalysisModel.updateHourlyChartData(response.data)
        return response.data
      } catch (error) {
        console.error('Failed to get hourly analysis trend:', error)
        throw error
      }
    },
  }),
})

export default analysisModel