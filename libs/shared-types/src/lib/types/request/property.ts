import { MetaPropertyBusinessType, MetaPropertyStatus, MetaPropertyType } from "../entity"

export interface IPropertyListItem {
  propertyName: string
  propertyType: MetaPropertyType
  type: MetaPropertyBusinessType
  status: MetaPropertyStatus
  eventPropertyRemark: string

  createTime: Date
  createUserId: number
  createUsername: string
  createNickname: string
  updateTime: Date
  updateUserId: number
  updateUsername: string
  updateNickname: string
}

export interface IQueryPropertyListReq {
  eventName: string
}

export type IQueryPropertyListRes = IPropertyListItem[]

/**
 * 公参数属性列表项
 */
export interface ICommonPropertyListItem {
  propertyName: string
  propertyType: MetaPropertyType
}

export type IQueryCommonPropertyListRes = ICommonPropertyListItem[]
