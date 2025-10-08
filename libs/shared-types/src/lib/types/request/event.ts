import { MetaEventStatus } from "../entity"
import { IPageQuery, IPageResult } from "./request"
import { IQueryPropertyListRes } from "./property"

export interface IQueryEventListReq extends IPageQuery {
  eventName?: string
  status?: MetaEventStatus
}

export interface IEventListItem {
  eventName: string
  eventAliases: string
  eventRemark: string
  createTime: Date
  createUserId: number
  createUsername: string
  createNickname: string
  updateTime: Date
  updateUsername: string,
  updateNickname: string,
  status: MetaEventStatus
}

export type IQueryEventListRes = IPageResult<IEventListItem>

// 事件关联属性请求参数
export interface IQueryEventPropertiesReq {
  eventName: string
}

// 事件关联属性返回值
export type IQueryEventPropertiesRes = IQueryPropertyListRes
