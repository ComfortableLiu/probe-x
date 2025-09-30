import request from "@/lib/request"
import { ILoginReq, ILoginRes, IPermission } from "./type"

export function queryLogin(data: ILoginReq) {
  return request<ILoginRes>({
    url: '/user/login',
    method: 'post',
    data,
  })
}

export function queryPermissionInfo() {
  return request<IPermission>({
    url: '/user/rolePermissionList',
    method: 'get',
  })
}
