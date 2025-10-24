import { MetaPropertyBusinessType, MetaPropertyStatus, MetaPropertyType } from "../entity"
import { IQueryEventListRes } from "./event"
import { IPageQuery } from "./request"

export interface IPropertyListItem {
  propertyName: string
  propertyType: MetaPropertyType
  type: MetaPropertyBusinessType
  status: MetaPropertyStatus
  eventPropertyRemark?: string

  createTime: Date | null
  createUserId: number
  createUsername: string
  createNickname: string
  updateTime: Date | null
  updateUserId: number
  updateUsername: string
  updateNickname: string
}

// 请求所有属性列表入参
export interface IQueryPropertyListReq extends IPageQuery{
  propertyName?: string
  type?: MetaPropertyBusinessType
}

// 请求所有属性列表返回值
export type IQueryPropertyListRes = IPropertyListItem[]

/**
 * 公参数属性列表项
 */
export interface ICommonPropertyListItem {
  propertyName: string
  propertyType: MetaPropertyType
}

// 所有公参的列表返回值
export type IQueryCommonPropertyListRes = ICommonPropertyListItem[]

// 属性关联事件请求参数
export interface IQueryPropertyEventsReq {
  propertyName: string
}

// 属性关联事件返回值
export type IQueryPropertyEventsRes = IQueryEventListRes

// 创建属性
export interface ICreatePropertyReq {
  propertyName: string
  propertyType: MetaPropertyType
  type: MetaPropertyBusinessType
  comment?: string
}

// 属性关联事件返回值
export type ICreatePropertyRes = IPropertyListItem
