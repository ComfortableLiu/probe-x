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

/**
 * 注册上报发现的事件
 */
export function registerEvent(data: { eventName: string; eventAliases?: string; eventRemark?: string }) {
  return request({
    url: '/event/register',
    method: 'post',
    data,
  })
}
