import { IPageQuery, IPageResult } from "./request"
import { TrackingNodeLevel, TrackingNodeStatus, TrackingNodeType } from "../entity"

export interface IQueryTrackingSpmListReq extends IPageQuery {
  name?: string,
  code?: string,
  parentCode?: string,
  status?: TrackingNodeStatus,
}

export interface ITrackingListItem {
  // 节点编码，生成规则是0-9a-zA-Z随机16个
  code: string
  // 节点类型 (SPM或SCM)
  type: TrackingNodeType
  // 节点层级 (1-4)
  level: TrackingNodeLevel
  // 节点名称
  name: string
  // 节点描述
  description?: string

  // 子节点个数
  childrenCount: number

  // 父节点Code (自引用)，层级1没有父节点
  parentCode?: string
  // 状态
  status: TrackingNodeStatus

  createTime: Date
  createUserId: number
  createUsername: string
  createNickname: string

  updateTime: Date
  updateUserId: number
  updateUsername: string,
  updateNickname: string,
}

export type IQueryTrackingSpmListRes = IPageResult<ITrackingListItem>


export interface IBusinessListItem {
  // 节点编码，生成规则是0-9a-zA-Z随机16个
  code: string
  // 节点类型 (SPM或SCM)
  type: TrackingNodeType
  // 节点层级 (1-4)
  level: TrackingNodeLevel
  // 节点名称
  name: string
  // 节点描述
  description?: string
  // 状态
  status: TrackingNodeStatus

  createTime: Date
  createUserId: number
  createUsername: string
  createNickname: string

  updateTime: Date
  updateUserId: number
  updateUsername: string,
  updateNickname: string,
}

export type IQueryBusinessListRes = IBusinessListItem[]

/**
 * 创建业务线/站点
 */
export interface ICreateBusinessSiteReq {
  // 节点名称
  name: string
  // 节点描述
  description?: string
}

export type ICreateBusinessSiteRes = IBusinessListItem

/**
 * 修改业务线/站点
 */
export interface IUpdateBusinessSiteReq {
  // 节点Code
  code: string
  // 节点名称
  name: string
  // 节点描述
  description?: string
}

export type IUpdateBusinessSiteRes = IBusinessListItem