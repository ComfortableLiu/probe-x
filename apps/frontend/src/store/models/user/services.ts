import request from "@/lib/request"
import { ILoginReq, ILoginRes } from "./type"
import { IPermission } from "@probe-x/shared-types/src/index"

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
