import { createModel } from "@rematch/core"
import { IPointManagePropertyState } from "./type"
import { RootModel } from "@/store/models"
import { queryPropertyEvents, queryPropertyList } from "./services"
import { IEventListItem, IQueryPropertyListReq, MetaPropertyBusinessType } from "@probe-x/shared-types/src"
import { getParamsOrQuery } from "@utils/router"

const initState: IPointManagePropertyState = {
  propertyList: [],
  page: 1,
  total: 0,
  pageSize: 1,
}

const pointManagePropertyModel = createModel<RootModel>()({
  name: 'pointManagePropertyModel',
  state: initState,
  reducers: {
    updateItem(state, payload) {
      return {
        ...state,
        ...payload,
      }
    },
    updatePropertyEvents(state, { propertyName, events }: { propertyName: string, events: IEventListItem[] }) {
      const event = state.propertyList.find((item) => item.propertyName === propertyName)
      event.events = events
      return state
    },
  },
  effects: (dispatch) => ({
    async getPropertyList() {
      const payload = getParamsOrQuery()
      const params: IQueryPropertyListReq = {
        propertyName: payload.propertyName,
        page: payload.page || 1,
        pageSize: payload.pageSize || 20,
        type: payload.type ? undefined : MetaPropertyBusinessType.BUSINESS,
      }
      const { data } = await queryPropertyList(params)
      dispatch.pointManagePropertyModel.updateItem({
        propertyList: data.data,
        total: data.total,
        page: data.page,
        pageSize: data.pageSize,
      })
    },
    // 获取属性的关联事件
    async getPropertyEvents({ propertyName }: { propertyName: string }) {
      const res = await queryPropertyEvents({ propertyName })
      const { data } = res
      dispatch.pointManagePropertyModel.updatePropertyEvents({ propertyName, events: data.data })
    },
  }),
})

export default pointManagePropertyModel
