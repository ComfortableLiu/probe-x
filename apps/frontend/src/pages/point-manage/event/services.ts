import request from "@/lib/request"
import {
  IQueryEventListReq,
  IQueryEventListRes,
  IQueryPropertyListReq,
  IQueryPropertyListRes,
} from "@probe-x/shared-types/src"

export function queryEventList(params: IQueryEventListReq) {
  return request<IQueryEventListRes>({
    url: '/event/list',
    method: 'get',
    params,
  })
}

/**
 * 获取事件的属性
 */
export function queryEventProperties(params: IQueryPropertyListReq) {
  return request<IQueryPropertyListRes>({
    url: '/property/list',
    method: 'get',
    params,
  })
}
