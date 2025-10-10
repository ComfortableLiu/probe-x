import { IBusinessListItem, ITrackingListItem } from "@probe-x/shared-types/src"

export interface IPointManageSpmState {
  total: number
  page: number
  pageSize: number
  businessList?: IBusinessListItem[]
  trackingSpmList: ITrackingSpmListItem[]
}

export interface ITrackingSpmListItem extends ITrackingListItem {
}
