import { IMetaEvent } from "@probe-x/shared-types/src"

export interface IPointManageEventState {
  total: number
  page: number
  pageSize: number
  eventList: IMetaEvent[]
}
