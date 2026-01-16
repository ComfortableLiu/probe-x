import { createModel } from "@rematch/core"
import { ISystemManageState } from "./type"
import { RootModel } from "@/store/models"
import {
  querySystemList,
  createSystem,
  updateSystem,
  deleteSystem,
} from "./services"
import {
  IQuerySystemListReq,
  ICreateSystemReq,
  IUpdateSystemReq,
  IDeleteSystemReq,
} from "./type"
import { getParamsOrQuery } from "@utils/router"
import { message } from "antd"

const initState: ISystemManageState = {
  systemList: [],
  pagination: {
    total: 0,
    current: 1,
    pageSize: 20,
  },
}

const systemConfigSystemManageModel = createModel<RootModel>()({
  name: 'systemConfigSystemManageModel',
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
    async getSystemList() {
      const payload = getParamsOrQuery()
      const params: IQuerySystemListReq = {
        systemKey: payload.systemKey,
        systemName: payload.systemName,
        isEnable: payload.isEnable !== undefined ? (payload.isEnable === 'true' || payload.isEnable === true || payload.isEnable === '1') : undefined,
        page: payload.page || 1,
        pageSize: payload.pageSize || 20,
      }
      const { data } = await querySystemList(params)
      dispatch.systemConfigSystemManageModel.updateItem({
        systemList: data.data || [],
        pagination: {
          total: data.total || 0,
          current: data.page || params.page || 1,
          pageSize: data.pageSize || params.pageSize || 20,
        },
      })
    },
    async createSystem(payload: ICreateSystemReq) {
      await createSystem(payload)
      message.success('创建系统成功')
      await dispatch.systemConfigSystemManageModel.getSystemList()
    },
    async updateSystem(payload: IUpdateSystemReq) {
      const response = await updateSystem(payload)
      if (response?.code === 200) {
        message.success('更新系统成功')
        // 刷新列表，确保显示最新数据
        await dispatch.systemConfigSystemManageModel.getSystemList()
      } else {
        message.error(response?.message || '更新系统失败')
      }
    },
    async deleteSystem(payload: IDeleteSystemReq) {
      await deleteSystem(payload)
      message.success('删除系统成功')
      await dispatch.systemConfigSystemManageModel.getSystemList()
    },
  }),
})

export default systemConfigSystemManageModel
