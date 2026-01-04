import { IUser } from "../user"
import { ResponseData } from "@probe-x/shared-utils/src/lib/backend-common"

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
  oldPassword: string
  newPassword: string
}

/**
 * 修改密码响应数据
 */
export interface IChangePasswordRes {
  userId: number
}

