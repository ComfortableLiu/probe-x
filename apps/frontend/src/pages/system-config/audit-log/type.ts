// 审计日志相关类型定义
import {
  IAuditLogListItem,
  IQueryAuditLogListReq,
  IQueryAuditLogListRes,
} from '@probe-x/shared-types/src'

export type {
  IAuditLogListItem,
  IQueryAuditLogListReq,
  IQueryAuditLogListRes,
}

export interface IAuditLogState {
  auditLogList: IAuditLogListItem[]
  pagination: {
    total: number
    current: number
    pageSize: number
  }
}
