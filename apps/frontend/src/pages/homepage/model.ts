import { createModel } from '@rematch/core'
import { RootModel } from '@/store/models'
import { IHomepageState } from './type'
import {
  getHomepageOverview,
  getHomepageTrend,
  getHomepageRealtimeEvents,
} from './services'

const initState: IHomepageState = {
  loading: false,
  overview: {
    todayEventCount: 0,
    activeUserCount: 0,
    newUserCount: 0,
    funnelConversionRate: 0,
    eventTrendChange: 0,
    userRetentionRate: 0,
    yesterdayEventCount: 0,
    yesterdayActiveUserCount: 0,
    weekEventCount: 0,
    totalEventCount: 0,
  },
  trend: {
    dates: [],
    eventCounts: [],
    activeUserCounts: [],
  },
  realtimeEvents: {
    list: [],
    total: 0,
  },
}

const homepageModel = createModel<RootModel>()({
  name: 'homepageModel',
  state: initState,
  reducers: {
    updateItem(state, payload) {
      return { ...state, ...payload }
    },
    setLoading(state, loading: boolean) {
      return { ...state, loading }
    },
  },
  effects: (dispatch) => ({
    /**
     * 获取首页所有数据
     */
    async fetchHomepageData() {
      try {
        dispatch.homepageModel.setLoading(true)
        const [overviewRes, trendRes, realtimeRes] = await Promise.all([
          getHomepageOverview(),
          getHomepageTrend(7),
          getHomepageRealtimeEvents(20),
        ])
        dispatch.homepageModel.updateItem({
          overview: overviewRes.data || initState.overview,
          trend: trendRes.data || initState.trend,
          realtimeEvents: realtimeRes.data || initState.realtimeEvents,
        })
      } catch (error) {
        console.error('Failed to fetch homepage data:', error)
      } finally {
        dispatch.homepageModel.setLoading(false)
      }
    },

    /**
      * 仅刷新实时事件流
     */
    async fetchRealtimeEvents() {
      try {
        const res = await getHomepageRealtimeEvents(20)
        dispatch.homepageModel.updateItem({
          realtimeEvents: res.data || initState.realtimeEvents,
        })
      } catch (error) {
        console.error('Failed to fetch realtime events:', error)
      }
    },
  }),
})

export default homepageModel
