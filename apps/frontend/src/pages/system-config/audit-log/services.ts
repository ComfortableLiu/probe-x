import request from "@/lib/request"
import {
  IQueryAuditLogListReq,
  IQueryAuditLogListRes,
} from "./type"

export function queryAuditLogList(params: IQueryAuditLogListReq) {
  return request<IQueryAuditLogListRes>({
    url: '/audit-log/list',
    method: 'get',
    params,
  })
}
