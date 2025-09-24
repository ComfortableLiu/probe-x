import { IQueryUserInfoParams, IUserInfo } from "@/models/application/type"
import request from "@/lib/request"
// import env from '@/patch/env'

// const SSORUL = env.ssoURL

export function queryUserInfo(data: IQueryUserInfoParams) {
  return request<IUserInfo>({
    url: '/system/v2/getUserByToken',
    method: 'get',
    target: '/ms/sso',
    // baseURL: SSORUL,
    data,
  })
}

export function queryPermissionInfo(params: { project: string }) {
  return request<IUserInfo>({
    url: '/system/v2/rolePermissionList',
    method: 'get',
    // baseURL: SSORUL,
    target: '/ms/sso',
    params,
  })
}
