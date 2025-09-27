import request from "@/lib/request"
import { IPermission, IQueryUserInfoParams, IUserInfo } from "./type"


export function queryUserInfo(data: IQueryUserInfoParams) {
  return request<IUserInfo>({
    url: '/sso/v1/getUserByToken',
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
