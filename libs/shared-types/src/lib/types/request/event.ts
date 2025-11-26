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

// 简化事件列表项
export interface IEventListItemSimple {
  eventName: string
  // 事件别名
  eventAliases: string
  // 事件描述
  eventRemark: string
}

// 简化事件列表
export type IEventListSimple = IEventListItemSimple[]

// 简化事件列表请求参数
export interface IQueryEventListSimpleReq {
}

// 简化事件列表返回值
export type IQueryEventListSimpleRes = IEventListSimple
