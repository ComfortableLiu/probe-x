import { IUtmItem, IUtmStatCursorRes } from "@probe-x/shared-types/src"

export type {
  IUtmItem,
  IUtmStatCursorRes,
}

/** 视图：有效条目 / 已删除条目 */
export type IUtmTab = "active" | "deleted"

export interface IUtmPagination {
  total: number
  current: number
  pageSize: number
}

export interface IPointManageUtmState {
  utmList: IUtmItem[]
  pagination: IUtmPagination
  cursor: IUtmStatCursorRes | null
}
