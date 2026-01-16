import { IBusinessListItem, ITrackingListItem } from "@probe-x/shared-types/src"

export interface IPointManageScmState {
  total: number
  page: number
  pageSize: number
  businessList?: IBusinessListItem[]
  trackingScmList: ITrackingScmListItem[]
}

export interface ITrackingScmListItem extends ITrackingListItem {
  child?: {
    total: number,
    page: number,
    pageSize: number,
    trackingScmList: ITrackingScmListItem[]
  }
}
