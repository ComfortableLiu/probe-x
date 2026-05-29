import { createModel } from "@rematch/core"
import { IAuditLogState } from "./type"
import { RootModel } from "@/store/models"
import { queryAuditLogList } from "./services"
import { getParamsOrQuery } from "@utils/router"

const initState: IAuditLogState = {
  auditLogList: [],
  pagination: {
    total: 0,
    current: 1,
    pageSize: 20,
  },
}

const systemConfigAuditLogModel = createModel<RootModel>()({
  name: 'systemConfigAuditLogModel',
  state: initState,
  reducers: {
    updateItem(state, payload) {
      return { ...state, ...payload }
    },
  },
  effects: (dispatch) => ({
    async getAuditLogList() {
      const payload = getParamsOrQuery()
      const params = {
        username: payload.username,
        action: payload.action,
        method: payload.method,
        startTime: payload.startTime,
        endTime: payload.endTime,
        page: payload.page || 1,
        pageSize: payload.pageSize || 20,
      }
      const { data } = await queryAuditLogList(params)
      dispatch.systemConfigAuditLogModel.updateItem({
        auditLogList: data.data || [],
        pagination: {
          total: data.total || 0,
          current: data.page || params.page || 1,
          pageSize: data.pageSize || params.pageSize || 20,
        },
      })
    },
  }),
})

export default systemConfigAuditLogModel
