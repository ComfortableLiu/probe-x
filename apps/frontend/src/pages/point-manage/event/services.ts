import request from "@/lib/request"
import {
  IQueryEventListReq,
  IQueryEventListRes,
  IQueryEventPropertiesReq,
  IQueryEventPropertiesRes,
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
export function queryEventProperties(params: IQueryEventPropertiesReq) {
  return request<IQueryEventPropertiesRes>({
    url: '/property/list',
    method: 'get',
    params,
  })
}
