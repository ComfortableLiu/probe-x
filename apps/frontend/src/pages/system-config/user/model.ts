import { createModel } from "@rematch/core"
import { IUserManageState } from "./type"
import { RootModel } from "@/store/models"
import {
  queryUserList,
  createUser,
  updateUser,
  deleteUser,
  resetPassword,
  assignRoles,
  queryRoleList,
} from "./services"
import {
  IQueryUserListReq,
  ICreateUserReq,
  IUpdateUserReq,
  IResetPasswordReq,
  IAssignRolesReq,
} from "./type"
import { getParamsOrQuery } from "@utils/router"
import { message } from "antd"

const initState: IUserManageState = {
  userList: [],
  roleList: [],
  pagination: {
    total: 0,
    current: 1,
    pageSize: 20,
  },
}

const systemConfigUserManageModel = createModel<RootModel>()({
  name: 'systemConfigUserManageModel',
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
    async getUserList() {
      const payload = getParamsOrQuery()
      const params: IQueryUserListReq = {
        username: payload.username,
        email: payload.email,
        isActive: payload.isActive !== undefined ? payload.isActive === 'true' || payload.isActive === true : undefined,
        page: payload.page || 1,
        pageSize: payload.pageSize || 20,
      }
      const { data } = await queryUserList(params)
      dispatch.systemConfigUserManageModel.updateItem({
        userList: data.data || [],
        pagination: {
          total: data.total || 0,
          current: data.page || params.page || 1,
          pageSize: data.pageSize || params.pageSize || 20,
        },
      })
    },
    async getRoleList() {
      try {
        const { data } = await queryRoleList()
        dispatch.systemConfigUserManageModel.updateItem({
          roleList: data || [],
        })
      } catch (error) {
        console.error('获取角色列表失败:', error)
      }
    },
    async createUser(payload: ICreateUserReq) {
      await createUser(payload)
      message.success('创建用户成功')
      await dispatch.systemConfigUserManageModel.getUserList()
    },
    async updateUser(payload: IUpdateUserReq) {
      await updateUser(payload)
      message.success('更新用户成功')
      await dispatch.systemConfigUserManageModel.getUserList()
    },
    async deleteUser(userId: number) {
      await deleteUser(userId)
      message.success('删除用户成功')
      await dispatch.systemConfigUserManageModel.getUserList()
    },
    async resetPassword(payload: IResetPasswordReq) {
      await resetPassword(payload)
      message.success('重置密码成功')
    },
    async assignRoles(payload: IAssignRolesReq) {
      await assignRoles(payload)
      message.success('分配角色成功')
      await dispatch.systemConfigUserManageModel.getUserList()
    },
  }),
})

export default systemConfigUserManageModel

