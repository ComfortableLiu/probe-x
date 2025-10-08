import { IEventListItem, IPropertyListItem as IReqPropertyListItem } from "@probe-x/shared-types/src"

export interface IPointManagePropertyState {
  total: number
  page: number
  pageSize: number
  propertyList: IPropertyListItem[]
}

export interface IPropertyListItem extends IReqPropertyListItem {
  events?: IEventListItem[]
}
