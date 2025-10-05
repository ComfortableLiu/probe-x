import { MetaEventStatus } from "../entity"
import { IPageResult } from "./request"

export interface IQueryEventListReq {
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
