// 通知设置相关类型定义
import {
  INotificationListItem,
  IQueryNotificationListReq,
  IQueryNotificationListRes,
  ICreateNotificationReq,
  IUpdateNotificationReq,
  ITestSendNotificationRes,
} from '@probe-x/shared-types/src'

export type {
  INotificationListItem,
  IQueryNotificationListReq,
  IQueryNotificationListRes,
  ICreateNotificationReq,
  IUpdateNotificationReq,
  ITestSendNotificationRes,
}

export interface INotificationManageState {
  notificationList: INotificationListItem[]
  pagination: {
    total: number
    current: number
    pageSize: number
  }
}
