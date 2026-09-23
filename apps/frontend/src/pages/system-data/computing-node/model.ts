import { createModel } from '@rematch/core'
import { RootModel } from '@/store/models'
import { ISystemDataComputingNodeState } from './type'
import { getComputingNodes } from './services'

const initState: ISystemDataComputingNodeState = {
  topology: null,
  loading: false,
  fetchedAt: null,
}

const computingNodeModel = createModel<RootModel>()({
  name: 'computingNodeModel',
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
    /** 拉取拓扑与链接状态；轮询和手动刷新共用 */
    async fetchTopology() {
      try {
        dispatch.computingNodeModel.setLoading(true)
        const res = await getComputingNodes()
        dispatch.computingNodeModel.updateItem({
          topology: res.data,
          fetchedAt: Date.now(),
        })
      } catch (error) {
        // 轮询失败不打断页面，沿用上次数据
        console.error('Failed to fetch computing node topology:', error)
      } finally {
        dispatch.computingNodeModel.setLoading(false)
      }
    },
  }),
})

export default computingNodeModel
