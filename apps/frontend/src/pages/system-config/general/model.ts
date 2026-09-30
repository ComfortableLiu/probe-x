import { createModel } from "@rematch/core"
import { RootModel } from "@/store/models"
import { message } from "antd"
import { IGeneralConfigState } from "./type"
import { getGeneralConfig, updateGeneralConfig, cleanNow } from "./services"
import { IGeneralConfig } from '@probe-x/shared-types/src'

const initState: IGeneralConfigState = {
  config: {
    enabled: false,
    dailyTime: '02:00',
  },
}

const systemConfigGeneralModel = createModel<RootModel>()({
  name: 'systemConfigGeneralModel',
  state: initState,
  reducers: {
    updateItem(state, payload) {
      return { ...state, ...payload }
    },
  },
  effects: (dispatch) => ({
    async getConfig() {
      const { data } = await getGeneralConfig()
      dispatch.systemConfigGeneralModel.updateItem({ config: data })
    },
    async saveConfig(payload: IGeneralConfig) {
      const { data } = await updateGeneralConfig(payload)
      dispatch.systemConfigGeneralModel.updateItem({ config: data })
      message.success('保存成功')
    },
    async cleanNow(payload: { date?: string }) {
      const { data } = await cleanNow(payload)
      message.success(`已触发清洗：下发 ${data.dispatched} 个任务，排队 ${data.pending} 个`)
    },
  }),
})

export default systemConfigGeneralModel
