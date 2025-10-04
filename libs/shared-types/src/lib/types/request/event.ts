import { IMetaEvent, MetaEventStatus } from "../entity"
import { IPageResult } from "./request"

export interface IQueryEventListReq {
  eventName?: string
  status?: MetaEventStatus
}

export type IQueryEventListRes = IPageResult<IMetaEvent>
