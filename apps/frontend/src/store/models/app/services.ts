import request from "@/lib/request"
import { IPermission, IQueryUserInfoParams, IUserInfo } from "./type"


export function queryLogin(data: { username: string, password: string }) {
  return request<IUserInfo>({
    url: '/user/login',
    method: 'post',
    data,
  })
}

export function queryUserInfo(data: IQueryUserInfoParams) {
  return request<IUserInfo>({
    url: '/user/getUserByToken',
    method: 'get',
    data,
  })
}

export function queryPermissionInfo() {
  return request<IPermission>({
    url: '/sso/v1/rolePermissionList',
    method: 'get',
  })
}
