import { createModel } from "@rematch/core"
import { RootModel } from "@/store/models"
import { IStaticState } from "@/store/models/static/type"
import { queryCommonProperties } from "@/store/models/static/services"

const initState: IStaticState = {
  commonPropertyList: [],
}

export const staticModel = createModel<RootModel>()({
  name: 'staticModel',
  state: initState,
  reducers: {
    updateItem(state, payload) {
      return {
        ...state,
        ...payload,
      }
    },
  },
  effects: (dispatch) => ({
    async init() {
      if (window.location.pathname === '/login') {
        return
      }
      await dispatch.staticModel.getPointList()
    },
    async getPointList() {
      const res = await queryCommonProperties()
      const { data } = res
      dispatch.staticModel.updateItem({ commonPropertyList: data })
    },
  }),
})
