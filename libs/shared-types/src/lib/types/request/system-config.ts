import { IPageQuery, IPageResult } from "./request"

/**
 * 查询用户列表请求参数
 */
export interface IQueryUserListReq extends IPageQuery {
  username?: string
  email?: string
  isActive?: boolean
}

/**
 * 用户列表项
 */
export interface IUserListItem {
  userId: number
  username: string
  email?: string
  nickname?: string
  isActive: boolean
  lastLogin?: Date
  createTime?: Date
  updateTime?: Date
  roles: string[]
  roleIds: number[]
}

/**
 * 查询用户列表响应
 */
export type IQueryUserListRes = IPageResult<IUserListItem>

/**
 * 创建用户请求参数
 */
export interface ICreateUserReq {
  username: string
  password: string
  email?: string
  nickname?: string
  isActive?: boolean
  roleIds?: number[]
}

/**
 * 创建用户响应数据
 */
export interface ICreateUserRes {
  userId: number
  username: string
  email?: string
  nickname?: string
  isActive: boolean
}

/**
 * 更新用户请求参数
 */
export interface IUpdateUserReq {
  userId: number
  email?: string
  nickname?: string
  isActive?: boolean
  roleIds?: number[]
}

/**
 * 更新用户响应数据
 */
export interface IUpdateUserRes {
  userId: number
  username: string
  email?: string
  nickname?: string
  isActive: boolean
}

/**
 * 删除用户请求参数
 */
export interface IDeleteUserReq {
  userId: number
}

/**
 * 删除用户响应数据
 */
export interface IDeleteUserRes {
  userId: number
}

/**
 * 重置密码请求参数
 */
export interface IResetPasswordReq {
  userId: number
  newPassword: string
}

/**
 * 重置密码响应数据
 */
export interface IResetPasswordRes {
  userId: number
}

/**
 * 分配角色请求参数
 */
export interface IAssignRolesReq {
  userId: number
  roleIds: number[]
}

/**
 * 分配角色响应数据
 */
export interface IAssignRolesRes {
  userId: number
  roleIds: number[]
}

/**
 * 角色选项
 */
export interface IRoleOption {
  id: number
  roleName: string
  roleKey: string
}

/**
 * 查询角色列表响应
 */
export type IQueryRoleListRes = IRoleOption[]

