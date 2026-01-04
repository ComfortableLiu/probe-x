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

/**
 * 查询角色列表请求参数（管理页面）
 */
export interface IQueryRoleManageListReq extends IPageQuery {
  roleName?: string
  roleKey?: string
  isSystemRole?: boolean
}

/**
 * 角色管理列表项
 */
export interface IRoleManageListItem {
  id: number
  roleKey: string
  roleName: string
  description?: string
  isSystemRole: boolean
  isEnable: boolean
  permissionCount: number
  userCount: number
  createTime?: Date
  updateTime?: Date
}

/**
 * 查询角色管理列表响应
 */
export type IQueryRoleManageListRes = IPageResult<IRoleManageListItem>

/**
 * 创建角色请求参数
 */
export interface ICreateRoleReq {
  roleKey: string
  roleName: string
  description?: string
  permissionIds?: number[]
}

/**
 * 创建角色响应数据
 */
export interface ICreateRoleRes {
  id: number
  roleKey: string
  roleName: string
  description?: string
}

/**
 * 更新角色请求参数
 */
export interface IUpdateRoleReq {
  id: number
  roleName?: string
  description?: string
  isEnable?: boolean
  permissionIds?: number[]
}

/**
 * 更新角色响应数据
 */
export interface IUpdateRoleRes {
  id: number
  roleKey: string
  roleName: string
  description?: string
  isEnable: boolean
}

/**
 * 删除角色请求参数
 */
export interface IDeleteRoleReq {
  id: number
}

/**
 * 删除角色响应数据
 */
export interface IDeleteRoleRes {
  id: number
}

/**
 * 分配权限请求参数
 */
export interface IAssignPermissionsReq {
  roleId: number
  permissionIds: number[]
}

/**
 * 分配权限响应数据
 */
export interface IAssignPermissionsRes {
  roleId: number
  permissionIds: number[]
}

/**
 * 权限选项
 */
export interface IPermissionOption {
  id: number
  permissionKey: string
  permissionName: string
  description?: string
}

/**
 * 查询权限列表响应
 */
export interface IQueryPermissionListRes {
  data: IPermissionOption[]
}

