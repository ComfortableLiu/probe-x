import request from "@/lib/request"
import { ILoginReq, ILoginRes } from "./type"
import { IPermissionRes } from "@probe-x/shared-types/src/index"

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
