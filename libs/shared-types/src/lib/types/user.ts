export interface IUser {
  userId?: number
  username?: string
  email?: string
  passwordHash?: string
  nickname?: string
  isActive?: boolean
  createdAt?: Date
  updatedAt?: Date
  lastLogin?: Date
}

export interface IPermission {
  // 例：页面key:['子权限1','子权限2']
  [pageKey: string]: string[]
}

/**
 * 用户状态枚举
 */
export enum UserStatus {
  // 激活
  ACTIVE = 1,
  // 禁用
  DISABLED = 2,
  // 已删除
  DELETED = 3,
}
