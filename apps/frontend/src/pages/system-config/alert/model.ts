import { createModel } from "@rematch/core"
import { IAlertRuleState } from "./type"
import { RootModel } from "@/store/models"
import { queryAlertRuleList, createAlertRule, updateAlertRule, deleteAlertRule, queryAlertHistoryList } from "./services"
import { ICreateAlertRuleReq, IUpdateAlertRuleReq } from "./type"
import { getParamsOrQuery } from "@utils/router"
import { message } from "antd"

const initState: IAlertRuleState = {
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

const systemConfigAlertModel = createModel<RootModel>()({
  name: 'systemConfigAlertModel',
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
        ruleName: payload.ruleName,
        ruleType: payload.ruleType,
        isEnable: payload.isEnable !== undefined ? payload.isEnable === 'true' || payload.isEnable === true : undefined,
        page: payload.page || 1,
        pageSize: payload.pageSize || 20,
      }
      const { data } = await queryAlertRuleList(params)
      dispatch.systemConfigAlertModel.updateItem({
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
      await dispatch.systemConfigAlertModel.getAlertRuleList()
    },
    async updateAlertRule(payload: IUpdateAlertRuleReq) {
      await updateAlertRule(payload)
      message.success('更新告警规则成功')
      await dispatch.systemConfigAlertModel.getAlertRuleList()
    },
    async deleteAlertRule(id: number) {
      await deleteAlertRule(id)
      message.success('删除告警规则成功')
      await dispatch.systemConfigAlertModel.getAlertRuleList()
    },
    async getAlertHistoryList() {
      const payload = getParamsOrQuery()
      const params = {
        alertLevel: payload.alertLevel,
        alertRuleId: payload.alertRuleId ? Number(payload.alertRuleId) : undefined,
        startTime: payload.startTime,
        endTime: payload.endTime,
        page: payload.page || 1,
        pageSize: payload.pageSize || 20,
      }
      const { data } = await queryAlertHistoryList(params)
      dispatch.systemConfigAlertModel.updateItem({
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

export default systemConfigAlertModel
