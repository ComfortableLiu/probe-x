import request from "@/lib/request"
import {
  IQueryAlertRuleListReq,
  IQueryAlertRuleListRes,
  ICreateAlertRuleReq,
  IUpdateAlertRuleReq,
  IQueryAlertHistoryListReq,
  IQueryAlertHistoryListRes,
} from "./type"

export function queryAlertRuleList(params: IQueryAlertRuleListReq) {
  return request<IQueryAlertRuleListRes>({
    url: '/alert/rules',
    method: 'get',
    params,
  })
}

export function createAlertRule(data: ICreateAlertRuleReq) {
  return request({
    url: '/alert/rules/create',
    method: 'post',
    data,
  })
}

export function updateAlertRule(data: IUpdateAlertRuleReq) {
  return request({
    url: '/alert/rules/update',
    method: 'post',
    data,
  })
}

export function deleteAlertRule(id: number) {
  return request({
    url: '/alert/rules/delete',
    method: 'post',
    data: { id },
  })
}

export function queryAlertHistoryList(params: IQueryAlertHistoryListReq) {
  return request<IQueryAlertHistoryListRes>({
    url: '/alert/history',
    method: 'get',
    params,
  })
}
