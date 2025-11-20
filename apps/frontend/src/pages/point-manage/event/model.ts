import { createModel } from "@rematch/core"
import { IPointManageEventState } from "@pages/point-manage/event/type"
import { RootModel } from "@/store/models"
import { queryEventList, queryEventProperties } from "@pages/point-manage/event/services"
import { IPropertyListItem, IQueryEventListReq } from "@probe-x/shared-types/src"
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
    updateEventProperties(state, { eventName, properties }: { eventName: string, properties: IPropertyListItem[] }) {
      const event = state.eventList.find((item) => item.eventName === eventName)
      event.properties = properties
      return state
    },
  },
  effects: (dispatch) => ({
    async getEventList() {
      const payload = getParamsOrQuery()

      const params: IQueryEventListReq = {
        eventName: payload.eventName,
        status: payload.status,
        page: payload.page || 1,
        pageSize: payload.pageSize || 20,
      }
      const { data } = await queryEventList(params)
      dispatch.pointManageEventModel.updateItem({
        eventList: data.data,
        total: data.total,
        page: data.page,
        pageSize: data.pageSize,
      })
    },
    // 获取事件的属性
    async getEventProperties({ eventName }: { eventName: string }) {
      const res = await queryEventProperties({ eventName })
      const { data } = res
      dispatch.pointManageEventModel.updateEventProperties({ eventName, properties: data })
    },
  }),
})

export default pointManageEventModel
