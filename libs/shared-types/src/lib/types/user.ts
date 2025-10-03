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

export interface IPermissionRes {
  roles: {
    id: number
    roleName: string
    roleKey: string
  }[]
  allPermissions: {
    id: number
    permissionKey: string
    permissionName: string
  }[]
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
