import request from "@/lib/request"
import { ILoginReq, ILoginRes } from "./type"
import { IPermissionRes, IUser, IUpdateUserProfileReq, IUpdateUserProfileRes, IChangePasswordReq, IChangePasswordRes } from "@probe-x/shared-types/src/index"

export function queryLogin(data: ILoginReq) {
  return request<ILoginRes>({
    url: '/user/login',
    method: 'post',
    data,
  })
}

export function queryPermissionInfo() {
  return request<IPermissionRes>({
    url: '/user/rolePermissionList',
    method: 'get',
  })
}

/**
 * 刷新登录token
 */
export function refreshToken(refreshToken: string) {
  return request<ILoginRes>({
    url: '/user/refreshToken',
    method: 'get',
    params: {
      refreshToken,
    },
  })
}

/**
 * 获取当前用户信息
 */
export function getCurrentUser() {
  return request<{ data: IUser }>({
    url: '/user/profile',
    method: 'get',
  })
}

/**
 * 更新用户个人信息
 */
export function updateUserProfile(data: IUpdateUserProfileReq) {
  return request<IUpdateUserProfileRes>({
    url: '/user/profile/update',
    method: 'post',
    data,
  })
}

/**
 * 修改密码
 */
export function changePassword(data: IChangePasswordReq) {
  return request<IChangePasswordRes>({
    url: '/user/changePassword',
    method: 'post',
    data,
  })
}
