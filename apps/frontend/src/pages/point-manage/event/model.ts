import { createModel } from "@rematch/core"
import { IPointManageEventState } from "@pages/point-manage/event/type"
import { RootModel } from "@/store/models"
import { queryEventList } from "@pages/point-manage/event/services"
import { IQueryEventListReq } from "@probe-x/shared-types/src"
import { getParamsOrQuery } from "@utils/router"

const initState: IPointManageEventState = {
  eventList: [],
  page: 1,
  total: 0,
  pageSize: 1,
}

const pointManageEventModel = createModel<RootModel>()({
  name: 'pointManageEventModel',
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
      const payload: IQueryEventListReq = getParamsOrQuery()
      const { data } = await queryEventList(payload)
      dispatch.pointManageEventModel.updateItem({
        eventList: data.data,
        total: data.total,
        page: data.page,
        pageSize: data.pageSize,
      })
    },
  }),
})

export default pointManageEventModel
