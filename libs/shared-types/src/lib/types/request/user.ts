import { IUser } from "../user"

/**
 * 更新用户个人信息请求参数
 */
export interface IUpdateUserProfileReq {
  email?: string
  nickname?: string
}

/**
 * 更新用户个人信息响应数据
 */
export interface IUpdateUserProfileRes extends IUser {}

/**
 * 修改密码请求参数
 */
export interface IChangePasswordReq {
  oldPassword?: string // 可选，首次设置密码时可以不提供
  newPassword: string
}

/**
 * 修改密码响应数据
 */
export interface IChangePasswordRes {
  userId: number
}

