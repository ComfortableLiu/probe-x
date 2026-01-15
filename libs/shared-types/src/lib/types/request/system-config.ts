import { IPageQuery, IPageResult } from "./request"

/**
 * 查询用户列表请求参数
 */
export interface IQueryUserListReq extends IPageQuery {
  /** 用户名（模糊搜索） */
  username?: string
  /** 邮箱（模糊搜索） */
  email?: string
  /** 是否激活 */
  isActive?: boolean
}

/**
 * 用户列表项
 */
export interface IUserListItem {
  /** 用户ID */
  userId: number
  /** 用户名 */
  username: string
  /** 邮箱地址 */
  email?: string
  /** 昵称 */
  nickname?: string
  /** 是否激活 */
  isActive: boolean
  /** 最后登录时间 */
  lastLogin?: Date
  /** 创建时间 */
  createTime?: Date
  /** 更新时间 */
  updateTime?: Date
  /** 角色名称列表 */
  roles: string[]
  /** 角色ID列表 */
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
  /** 用户名（必填，唯一） */
  username: string
  /** 密码（必填） */
  password: string
  /** 邮箱地址（可选，唯一） */
  email?: string
  /** 昵称（可选） */
  nickname?: string
  /** 是否激活（默认 true） */
  isActive?: boolean
  /** 角色ID列表（可选） */
  roleIds?: number[]
}

/**
 * 创建用户响应数据
 */
export interface ICreateUserRes {
  /** 用户ID */
  userId: number
  /** 用户名 */
  username: string
  /** 邮箱地址 */
  email?: string
  /** 昵称 */
  nickname?: string
  /** 是否激活 */
  isActive: boolean
}

/**
 * 更新用户请求参数
 */
export interface IUpdateUserReq {
  /** 用户ID（必填） */
  userId: number
  /** 邮箱地址（可选） */
  email?: string
  /** 昵称（可选） */
  nickname?: string
  /** 是否激活（可选） */
  isActive?: boolean
  /** 角色ID列表（可选，传入后会替换原有角色） */
  roleIds?: number[]
}

/**
 * 更新用户响应数据
 */
export interface IUpdateUserRes {
  /** 用户ID */
  userId: number
  /** 用户名 */
  username: string
  /** 邮箱地址 */
  email?: string
  /** 昵称 */
  nickname?: string
  /** 是否激活 */
  isActive: boolean
}

/**
 * 删除用户请求参数
 */
export interface IDeleteUserReq {
  /** 用户ID */
  userId: number
}

/**
 * 删除用户响应数据
 */
export interface IDeleteUserRes {
  /** 已删除的用户ID */
  userId: number
}

/**
 * 重置密码请求参数
 */
export interface IResetPasswordReq {
  /** 用户ID */
  userId: number
  /** 新密码 */
  newPassword: string
}

/**
 * 重置密码响应数据
 */
export interface IResetPasswordRes {
  /** 已重置密码的用户ID */
  userId: number
}

/**
 * 分配角色请求参数
 */
export interface IAssignRolesReq {
  /** 用户ID */
  userId: number
  /** 角色ID列表（会替换用户原有的所有角色） */
  roleIds: number[]
}

/**
 * 分配角色响应数据
 */
export interface IAssignRolesRes {
  /** 用户ID */
  userId: number
  /** 已分配的角色ID列表 */
  roleIds: number[]
}

/**
 * 角色选项（用于下拉选择等场景）
 */
export interface IRoleOption {
  /** 角色ID */
  id: number
  /** 角色名称 */
  roleName: string
  /** 角色标识（唯一） */
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
  /** 角色名称（模糊搜索） */
  roleName?: string
  /** 角色标识（模糊搜索） */
  roleKey?: string
  /** 是否为系统角色（true-仅查询系统角色，false-仅查询自定义角色，undefined-查询所有） */
  isSystemRole?: boolean
}

/**
 * 角色管理列表项
 */
export interface IRoleManageListItem {
  /** 角色ID */
  id: number
  /** 角色标识（唯一，系统角色为预定义值） */
  roleKey: string
  /** 角色名称 */
  roleName: string
  /** 角色描述 */
  description?: string
  /** 是否为系统角色（系统角色不可修改和删除） */
  isSystemRole: boolean
  /** 是否启用 */
  isEnable: boolean
  /** 关联的权限数量 */
  permissionCount: number
  /** 关联的用户数量 */
  userCount: number
  /** 创建时间 */
  createTime?: Date
  /** 更新时间 */
  updateTime?: Date
}

/**
 * 查询角色管理列表响应
 */
export type IQueryRoleManageListRes = IPageResult<IRoleManageListItem>

/**
 * 创建角色请求参数
 * 注意：只能创建自定义角色，系统角色由系统预定义，无法手动创建
 */
export interface ICreateRoleReq {
  /** 角色标识（必填，只能包含小写字母、数字和下划线，唯一） */
  roleKey: string
  /** 角色名称（必填，唯一） */
  roleName: string
  /** 角色描述（可选） */
  description?: string
  /** 权限ID列表（可选，创建时可同时分配权限） */
  permissionIds?: number[]
}

/**
 * 创建角色响应数据
 */
export interface ICreateRoleRes {
  /** 角色ID */
  id: number
  /** 角色标识 */
  roleKey: string
  /** 角色名称 */
  roleName: string
  /** 角色描述 */
  description?: string
}

/**
 * 更新角色请求参数
 * 注意：系统角色只能更新描述，其他字段不可修改；超管角色完全不可编辑
 */
export interface IUpdateRoleReq {
  /** 角色ID（必填） */
  id: number
  /** 角色名称（可选，系统角色不可修改） */
  roleName?: string
  /** 角色描述（可选，系统角色可修改） */
  description?: string
  /** 是否启用（可选，系统角色不可禁用） */
  isEnable?: boolean
  /** 权限ID列表（可选，传入后会替换原有权限，系统角色不可修改权限） */
  permissionIds?: number[]
}

/**
 * 更新角色响应数据
 */
export interface IUpdateRoleRes {
  /** 角色ID */
  id: number
  /** 角色标识 */
  roleKey: string
  /** 角色名称 */
  roleName: string
  /** 角色描述 */
  description?: string
  /** 是否启用 */
  isEnable: boolean
}

/**
 * 删除角色请求参数
 * 注意：系统角色不可删除；如果角色被用户使用，也无法删除
 */
export interface IDeleteRoleReq {
  /** 角色ID */
  id: number
}

/**
 * 删除角色响应数据
 */
export interface IDeleteRoleRes {
  /** 已删除的角色ID */
  id: number
}

/**
 * 分配权限请求参数
 * 注意：系统角色的权限由系统配置决定，无法手动修改；超管角色拥有所有权限，无需分配
 */
export interface IAssignPermissionsReq {
  /** 角色ID */
  roleId: number
  /** 权限ID列表（会替换角色原有的所有权限） */
  permissionIds: number[]
}

/**
 * 分配权限响应数据
 */
export interface IAssignPermissionsRes {
  /** 角色ID */
  roleId: number
  /** 已分配的权限ID列表 */
  permissionIds: number[]
}

/**
 * 权限选项（用于权限分配等场景，支持树形结构）
 */
export interface IPermissionOption {
  /** 权限ID */
  id: number
  /** 权限标识（唯一） */
  permissionKey: string
  /** 权限名称 */
  permissionName: string
  /** 权限描述 */
  description?: string
  /** 父权限ID（0或null表示顶级权限/页面） */
  parentId?: number | null
  /** 权限层级（用于标识和排序，支持任意层数，1=页面/顶级，2=功能，3=子功能，以此类推） */
  level?: number
  /** 子权限列表（树形结构） */
  children?: IPermissionOption[]
}

/**
 * 查询权限列表响应
 */
export interface IQueryPermissionListRes {
  /** 权限树形列表 */
  data: IPermissionOption[]
}

