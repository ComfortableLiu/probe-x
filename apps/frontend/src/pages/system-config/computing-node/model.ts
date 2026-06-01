import { createModel } from "@rematch/core"
import { IComputeNodeManageState } from "./type"
import { RootModel } from "@/store/models"
import { queryComputeNodeList, createComputeNode, updateComputeNode, deleteComputeNode } from "./services"
import { ICreateComputeNodeReq, IUpdateComputeNodeReq } from "./type"
import { getParamsOrQuery } from "@utils/router"
import { message } from "antd"

const initState: IComputeNodeManageState = {
  nodeList: [],
  pagination: {
    total: 0,
    current: 1,
    pageSize: 20,
  },
}

const systemConfigComputeNodeModel = createModel<RootModel>()({
  name: 'systemConfigComputeNodeModel',
  state: initState,
  reducers: {
    updateItem(state, payload) {
      return { ...state, ...payload }
    },
  },
  effects: (dispatch) => ({
    async getNodeList() {
      const payload = getParamsOrQuery()
      const params = {
        nodeName: payload.nodeName,
        status: payload.status,
        page: payload.page || 1,
        pageSize: payload.pageSize || 20,
      }
      const { data } = await queryComputeNodeList(params)
      dispatch.systemConfigComputeNodeModel.updateItem({
        nodeList: data.data || [],
        pagination: {
          total: data.total || 0,
          current: data.page || params.page || 1,
          pageSize: data.pageSize || params.pageSize || 20,
        },
      })
    },
    async createNode(payload: ICreateComputeNodeReq) {
      await createComputeNode(payload)
      message.success('创建计算节点成功')
      await dispatch.systemConfigComputeNodeModel.getNodeList()
    },
    async updateNode(payload: IUpdateComputeNodeReq) {
      await updateComputeNode(payload)
      message.success('更新计算节点成功')
      await dispatch.systemConfigComputeNodeModel.getNodeList()
    },
    async deleteNode(id: number) {
      await deleteComputeNode(id)
      message.success('删除计算节点成功')
      await dispatch.systemConfigComputeNodeModel.getNodeList()
    },
  }),
})

export default systemConfigComputeNodeModel
