import { createModel } from "@rematch/core"
import { RootModel } from "@/store/models"
import { IPointState } from "./type"
import { queryEventList } from "@/store/models/point/services"

const initState: IPointState = {
  eventList: [],
}

export const pointModel = createModel<RootModel>()({
  name: 'pointModel',
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
    async getEventList() {
      const res = await queryEventList()
      const { data } = res
      dispatch.pointModel.updateItem({ eventList: data })
    },
  }),
})
