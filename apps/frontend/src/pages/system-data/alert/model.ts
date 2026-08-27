import { createModel } from "@rematch/core"
import { IAlertState } from "./type"
import { RootModel } from "@/store/models"
import { queryAlertRuleList, createAlertRule, updateAlertRule, deleteAlertRule, toggleAlertRule, queryAlertHistoryList } from "./services"
import { ICreateAlertRuleReq, IUpdateAlertRuleReq } from "./type"
import { getParamsOrQuery } from "@utils/router"
import { message } from "antd"

const initState: IAlertState = {
  ruleList: [],
  rulePagination: {
    total: 0,
    current: 1,
    pageSize: 20,
  },
  historyList: [],
  historyPagination: {
    total: 0,
    current: 1,
    pageSize: 20,
  },
  activeTab: 'rules',
}

const systemDataAlertModel = createModel<RootModel>()({
  name: 'systemDataAlertModel',
  state: initState,
  reducers: {
    updateItem(state, payload) {
      return { ...state, ...payload }
    },
  },
  effects: (dispatch) => ({
    async getAlertRuleList() {
      const payload = getParamsOrQuery()
      const params = {
        name: payload.name,
        level: payload.level,
        enabled: payload.enabled !== undefined ? payload.enabled === 'true' || payload.enabled === true : undefined,
        page: payload.page || 1,
        pageSize: payload.pageSize || 20,
      }
      const { data } = await queryAlertRuleList(params)
      dispatch.systemDataAlertModel.updateItem({
        ruleList: data.data || [],
        rulePagination: {
          total: data.total || 0,
          current: data.page || params.page || 1,
          pageSize: data.pageSize || params.pageSize || 20,
        },
      })
    },
    async createAlertRule(payload: ICreateAlertRuleReq) {
      await createAlertRule(payload)
      message.success('创建告警规则成功')
      await dispatch.systemDataAlertModel.getAlertRuleList()
    },
    async updateAlertRule(payload: IUpdateAlertRuleReq) {
      await updateAlertRule(payload)
      message.success('更新告警规则成功')
      await dispatch.systemDataAlertModel.getAlertRuleList()
    },
    async deleteAlertRule(id: number) {
      await deleteAlertRule(id)
      message.success('删除告警规则成功')
      await dispatch.systemDataAlertModel.getAlertRuleList()
    },
    async toggleAlertRule(payload: { id: number; enabled: boolean }) {
      await toggleAlertRule(payload.id, payload.enabled)
      message.success(payload.enabled ? '已启用' : '已禁用')
      await dispatch.systemDataAlertModel.getAlertRuleList()
    },
    async getAlertHistoryList() {
      const payload = getParamsOrQuery()
      const params = {
        ruleId: payload.ruleId ? Number(payload.ruleId) : undefined,
        level: payload.level,
        startTime: payload.startTime,
        endTime: payload.endTime,
        page: payload.page || 1,
        pageSize: payload.pageSize || 20,
      }
      const { data } = await queryAlertHistoryList(params)
      dispatch.systemDataAlertModel.updateItem({
        historyList: data.data || [],
        historyPagination: {
          total: data.total || 0,
          current: data.page || params.page || 1,
          pageSize: data.pageSize || params.pageSize || 20,
        },
      })
    },
  }),
})

export default systemDataAlertModel
