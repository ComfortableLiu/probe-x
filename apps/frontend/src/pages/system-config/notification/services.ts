import request from "@/lib/request"
import {
  IQueryNotificationListReq,
  IQueryNotificationListRes,
  ICreateNotificationReq,
  IUpdateNotificationReq,
  ITestSendNotificationRes,
} from "./type"

export function queryNotificationList(params: IQueryNotificationListReq) {
  return request<IQueryNotificationListRes>({
    url: '/notification/list',
    method: 'get',
    params,
  })
}

export function createNotification(data: ICreateNotificationReq) {
  return request({
    url: '/notification/create',
    method: 'post',
    data,
  })
}

export function updateNotification(data: IUpdateNotificationReq) {
  return request({
    url: '/notification/update',
    method: 'post',
    data,
  })
}

export function deleteNotification(id: number) {
  return request({
    url: '/notification/delete',
    method: 'post',
    data: { id },
  })
}

export function testSendNotification(id: number) {
  return request<ITestSendNotificationRes>({
    url: '/notification/test-send',
    method: 'post',
    data: { id },
  })
}
