import { createModel } from "@rematch/core"
import { RootModel } from "@/store/models"
import { ISystemDataOverviewWithMetaState } from "./type"
import { getSystemDataOverview } from "./services"

const initState: ISystemDataOverviewWithMetaState = {
  loading: false,
  metaOverview: {
    originalDataTotal: '0',
    finalCleanedData: '0',
    firstCleaningSuccessRate: 0,
    finalCleaningSuccessRate: 0,
  },
  computingNodeStatus: {
    totalNodes: 0,
    onlineNodes: 0,
    offlineNodes: 0,
    onlineRate: 0,
    cpuUsage: 0,
    memoryUsage: 0,
    avgLoad: 0,
    networkTraffic: 0,
  },
  systemPerformanceMetrics: {
    currentQps: 0,
    peakQps: 0,
    avgQps: 0,
    avgResponseTime: 0,
    p95ResponseTime: 0,
    p99ResponseTime: 0,
    systemAvailability: 0,
    currentMonthAvailability: 0,
    requestErrorRate: 0,
    systemErrorRate: 0,
    exceptionCaptureRate: 0,
  },
  eventCollectionMetrics: {
    todayCollection: 0,
    yesterdayCollection: 0,
    weekCollection: 0,
    monthCollection: 0,
    totalAmount: 0,
  },
  realTimeProcessingMetrics: {
    currentProcessing: 0,
    peakProcessing: 0,
    cumulativeProcessing: 0,
  },
}

const systemDataOverviewModel = createModel<RootModel>()({
  name: 'systemDataOverviewModel',
  state: initState,
  reducers: {
    updateItem(state, payload) {
      return {
        ...state,
        ...payload,
      }
    },
    setLoading(state, loading) {
      return {
        ...state,
        loading,
      }
    },
  },
  effects: (dispatch) => ({
    // 获取系统数据概览
    async fetchSystemDataOverview() {
      try {
        dispatch.systemDataOverviewModel.setLoading(true)
        const res = await getSystemDataOverview()

        dispatch.systemDataOverviewModel.updateItem(res.data)
      } catch (error) {
        console.error('Failed to fetch system data overview:', error)
      } finally {
        dispatch.systemDataOverviewModel.setLoading(false)
      }
    },
  }),
})

export default systemDataOverviewModel
