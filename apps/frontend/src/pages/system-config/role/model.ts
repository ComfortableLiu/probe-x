import { createModel } from "@rematch/core"
import { IRoleManageState } from "./type"
import { RootModel } from "@/store/models"
import {
  queryRoleList,
  createRole,
  updateRole,
  deleteRole,
  assignPermissions,
  queryPermissionList,
} from "./services"
import {
  IQueryRoleListReq,
  ICreateRoleReq,
  IUpdateRoleReq,
  IDeleteRoleReq,
  IAssignPermissionsReq,
} from "./type"
import { getParamsOrQuery } from "@utils/router"
import { message } from "antd"

const initState: IRoleManageState = {
  roleList: [],
  pagination: {
    total: 0,
    current: 1,
    pageSize: 20,
  },
}

const systemConfigRoleManageModel = createModel<RootModel>()({
  name: 'systemConfigRoleManageModel',
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
    async getRoleList() {
      const payload = getParamsOrQuery()
      const systemId = payload.systemId
      const params: IQueryRoleListReq = {
        roleName: payload.roleName,
        roleKey: payload.roleKey,
        isSystemRole: payload.isSystemRole !== undefined && payload.isSystemRole !== null && payload.isSystemRole !== ''
          ? (payload.isSystemRole === 'true' || payload.isSystemRole === true || payload.isSystemRole === '1')
          : undefined,
        systemId: systemId !== undefined && systemId !== null && systemId !== ''
          ? (systemId === 'null' ? null : Number(systemId))
          : undefined,
        page: payload.page || 1,
        pageSize: payload.pageSize || 20,
      }
      const { data } = await queryRoleList(params)
      dispatch.systemConfigRoleManageModel.updateItem({
        roleList: data.data || [],
        pagination: {
          total: data.total || 0,
          current: data.page || params.page || 1,
          pageSize: data.pageSize || params.pageSize || 20,
        },
      })
    },
    async createRole(payload: ICreateRoleReq) {
      await createRole(payload)
      message.success('创建角色成功')
      await dispatch.systemConfigRoleManageModel.getRoleList()
    },
    async updateRole(payload: IUpdateRoleReq) {
      await updateRole(payload)
      message.success('更新角色成功')
      await dispatch.systemConfigRoleManageModel.getRoleList()
    },
    async deleteRole(payload: IDeleteRoleReq) {
      await deleteRole(payload)
      message.success('删除角色成功')
      await dispatch.systemConfigRoleManageModel.getRoleList()
    },
    async assignPermissions(payload: IAssignPermissionsReq) {
      await assignPermissions(payload)
      message.success('分配权限成功')
      await dispatch.systemConfigRoleManageModel.getRoleList()
    },
  }),
})

export default systemConfigRoleManageModel

