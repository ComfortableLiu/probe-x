import request from "@/lib/request"
import {
  IQueryPropertyEventsReq,
  IQueryPropertyEventsRes,
  IQueryPropertyListReq,
  IQueryPropertyListRes,
} from "@probe-x/shared-types/src"

/**
 * 获取属性列表
 */
export function queryPropertyList(params: IQueryPropertyListReq) {
  return request<IQueryPropertyListRes>({
    url: '/property/list',
    method: 'get',
    params,
  })
}

/**
 * 获取关联当前属性的事件
 */
export function queryPropertyEvents(params: IQueryPropertyEventsReq) {
  return request<IQueryPropertyEventsRes>({
    url: '/event/list',
    method: 'get',
    params,
  })
}
