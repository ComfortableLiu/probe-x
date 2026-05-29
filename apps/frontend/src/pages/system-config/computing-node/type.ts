// 计算节点配置相关类型定义
import {
  IComputeNodeListItem,
  IQueryComputeNodeListReq,
  IQueryComputeNodeListRes,
  ICreateComputeNodeReq,
  IUpdateComputeNodeReq,
} from '@probe-x/shared-types/src'

export type {
  IComputeNodeListItem,
  IQueryComputeNodeListReq,
  IQueryComputeNodeListRes,
  ICreateComputeNodeReq,
  IUpdateComputeNodeReq,
}

export interface IComputeNodeManageState {
  nodeList: IComputeNodeListItem[]
  pagination: {
    total: number
    current: number
    pageSize: number
  }
}
