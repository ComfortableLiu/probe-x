// 用户管理相关类型定义
import { IUser, IPageQuery, IPageResult } from "@probe-x/shared-types/src"

export interface IUserManageState {
  userList: IUserListItem[]
  roleList: IRoleOption[]
  pagination?: {
    total: number
    current: number
    pageSize: number
  }
}

export interface IUserListItem extends IUser {
  roles?: string[]
  roleIds?: number[]
  createTime?: string
  updateTime?: string
}

export interface IRoleOption {
  id: number
  roleName: string
  roleKey: string
}

export interface IQueryUserListReq extends IPageQuery {
  username?: string
  email?: string
  isActive?: boolean
}

export type IQueryUserListRes = IPageResult<IUserListItem>

export interface ICreateUserReq {
  username: string
  password: string
  email?: string
  nickname?: string
  isActive?: boolean
  roleIds?: number[]
}

export interface IUpdateUserReq {
  userId: number
  email?: string
  nickname?: string
  isActive?: boolean
  roleIds?: number[]
}

export interface IResetPasswordReq {
  userId: number
  newPassword: string
}

export interface IAssignRolesReq {
  userId: number
  roleIds: number[]
}
