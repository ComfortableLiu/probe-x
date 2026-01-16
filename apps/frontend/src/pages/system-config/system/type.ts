// 系统管理相关类型定义
import {
  IQuerySystemListReq,
  IQuerySystemListRes,
  ISystemListItem,
  ICreateSystemReq,
  ICreateSystemRes,
  IUpdateSystemReq,
  IUpdateSystemRes,
  IDeleteSystemReq,
  ISystemOption,
} from "@probe-x/shared-types/src"

export interface ISystemManageState {
  systemList: ISystemListItem[]
  pagination?: {
    total: number
    current: number
    pageSize: number
  }
}

export type {
  IQuerySystemListReq,
  IQuerySystemListRes,
  ISystemListItem,
  ICreateSystemReq,
  ICreateSystemRes,
  IUpdateSystemReq,
  IUpdateSystemRes,
  IDeleteSystemReq,
  ISystemOption,
}
