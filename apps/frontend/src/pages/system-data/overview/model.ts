import { createModel } from "@rematch/core"
import { RootModel } from "@/store/models"
import { ISystemDataOverviewWithMetaState } from "./type"
import { getSystemDataOverview } from "./services"

const initState: ISystemDataOverviewWithMetaState = {
  serviceResources: [],
  loading: false,
  error: null,
  updatedAt: null,
  warnings: [],
  analysisQueryMetrics: { todayQueries: null, yesterdayQueries: null, weekQueries: null, monthQueries: null },
  metaOverview: {
    originalDataTotal: '—',
    finalCleanedData: '—',
    firstCleaningSuccessRate: null,
    finalCleaningSuccessRate: null,
  },
  computingNodeStatus: {
    totalNodes: null,
    onlineNodes: null,
    offlineNodes: null,
    onlineRate: null,
    cpuUsage: null,
    memoryUsage: null,
    avgLoad: null,
    networkTraffic: null,
  },
  systemPerformanceMetrics: {
    currentQps: null,
    peakQps: null,
    avgQps: null,
    avgResponseTime: null,
    p95ResponseTime: null,
    p99ResponseTime: null,
    systemAvailability: null,
    currentMonthAvailability: null,
    requestErrorRate: null,
    systemErrorRate: null,
    businessErrorRate: null,
  },
  eventCollectionMetrics: {
    todayCollection: null,
    yesterdayCollection: null,
    weekCollection: null,
    monthCollection: null,
    totalAmount: null,
  },
  realTimeProcessingMetrics: {
    currentProcessing: null,
    peakProcessing: null,
    cumulativeProcessing: null,
  },
}

let fetching = false

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
      if (fetching) return
      fetching = true
      try {
        dispatch.systemDataOverviewModel.setLoading(true)
        const res = await getSystemDataOverview()

        if (!res.data) throw new Error('总览接口未返回数据')
        dispatch.systemDataOverviewModel.updateItem({ ...res.data, error: null })
      } catch (error) {
        dispatch.systemDataOverviewModel.updateItem({ error: '刷新失败，当前显示的是上次成功获取的数据，请稍后重试。' })
      } finally {
        fetching = false
        dispatch.systemDataOverviewModel.setLoading(false)
      }
    },
  }),
})

export default systemDataOverviewModel
