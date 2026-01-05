// 角色管理相关类型定义
import {
  IQueryRoleManageListReq,
  IQueryRoleManageListRes,
  IRoleManageListItem,
  ICreateRoleReq,
  IUpdateRoleReq,
  IDeleteRoleReq,
  IAssignPermissionsReq,
  IPermissionOption,
  IQueryPermissionListRes,
} from "@probe-x/shared-types/src"

export interface IRoleManageState {
  roleList: IRoleListItem[]
  pagination?: {
    total: number
    current: number
    pageSize: number
  }
}

export interface IRoleListItem extends IRoleManageListItem {
  createTime?: string
  updateTime?: string
}

export type IQueryRoleListReq = IQueryRoleManageListReq
export type IQueryRoleListRes = IQueryRoleManageListRes

// 重新导出共享类型
export type {
  ICreateRoleReq,
  IUpdateRoleReq,
  IDeleteRoleReq,
  IAssignPermissionsReq,
  IPermissionOption,
  IQueryPermissionListRes,
}
