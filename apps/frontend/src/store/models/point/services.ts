import request from "@/lib/request"
import { IQueryEventListSimpleRes, IQueryPropertyListSimpleRes } from "@probe-x/shared-types/src"

/**
 * 获取所有事件列表，简化版
 */
export function queryEventList() {
  return request<IQueryEventListSimpleRes>({
    url: '/event/list/simple',
    method: 'get',
  })
}

/**
 * 获取所有属性列表，简化版
 */
export function queryPropertyList() {
  return request<IQueryPropertyListSimpleRes>({
    url: '/property/list/simple',
    method: 'get',
  })
}
