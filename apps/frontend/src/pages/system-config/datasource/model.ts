import { createModel } from "@rematch/core"
import { IDataSourceManageState } from "./type"
import { RootModel } from "@/store/models"
import { queryDataSourceList, createDataSource, updateDataSource, deleteDataSource, testDataSourceConnection } from "./services"
import { ICreateDataSourceReq, IUpdateDataSourceReq } from "./type"
import { getParamsOrQuery } from "@utils/router"
import { message } from "antd"

const initState: IDataSourceManageState = {
  dataSourceList: [],
  pagination: {
    total: 0,
    current: 1,
    pageSize: 20,
  },
  testResult: undefined,
}

const systemConfigDataSourceModel = createModel<RootModel>()({
  name: 'systemConfigDataSourceModel',
  state: initState,
  reducers: {
    updateItem(state, payload) {
      return { ...state, ...payload }
    },
  },
  effects: (dispatch) => ({
    async getDataSourceList() {
      const payload = getParamsOrQuery()
      const params = {
        datasourceName: payload.datasourceName,
        datasourceType: payload.datasourceType,
        page: payload.page || 1,
        pageSize: payload.pageSize || 20,
      }
      const { data } = await queryDataSourceList(params)
      dispatch.systemConfigDataSourceModel.updateItem({
        dataSourceList: data.data || [],
        pagination: {
          total: data.total || 0,
          current: data.page || params.page || 1,
          pageSize: data.pageSize || params.pageSize || 20,
        },
      })
    },
    async createDataSource(payload: ICreateDataSourceReq) {
      await createDataSource(payload)
      message.success('创建数据源成功')
      await dispatch.systemConfigDataSourceModel.getDataSourceList()
    },
    async updateDataSource(payload: IUpdateDataSourceReq) {
      await updateDataSource(payload)
      message.success('更新数据源成功')
      await dispatch.systemConfigDataSourceModel.getDataSourceList()
    },
    async deleteDataSource(id: number) {
      await deleteDataSource(id)
      message.success('删除数据源成功')
      await dispatch.systemConfigDataSourceModel.getDataSourceList()
    },
    async testConnection(id: number) {
      try {
        const { data } = await testDataSourceConnection(id)
        dispatch.systemConfigDataSourceModel.updateItem({ testResult: data })
        if (data?.success) {
          message.success(`连接成功，延迟: ${data.latency}ms`)
        } else {
          message.error(`连接失败: ${data?.message}`)
        }
        await dispatch.systemConfigDataSourceModel.getDataSourceList()
      } catch {
        message.error('测试连接失败')
      }
    },
  }),
})

export default systemConfigDataSourceModel
