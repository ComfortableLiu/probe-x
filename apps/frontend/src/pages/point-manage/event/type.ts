import { IEventListItem as IReqEventListItem, IPropertyListItem } from "@probe-x/shared-types/src"

export interface IPointManageEventState {
  total: number
  page: number
  pageSize: number
  eventList: IEventListItem[]
}

export interface IEventListItem extends IReqEventListItem {
  properties?: IPropertyListItem[]
}
