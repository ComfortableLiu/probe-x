// 告警系统相关类型定义
import {
  IAlertRuleListItem,
  IQueryAlertRuleListReq,
  IQueryAlertRuleListRes,
  ICreateAlertRuleReq,
  IUpdateAlertRuleReq,
  IAlertHistoryListItem,
  IQueryAlertHistoryListReq,
  IQueryAlertHistoryListRes,
  AlertRuleType,
  AlertLevel,
} from '@probe-x/shared-types/src'

export type {
  IAlertRuleListItem,
  IQueryAlertRuleListReq,
  IQueryAlertRuleListRes,
  ICreateAlertRuleReq,
  IUpdateAlertRuleReq,
  IAlertHistoryListItem,
  IQueryAlertHistoryListReq,
  IQueryAlertHistoryListRes,
  AlertRuleType,
  AlertLevel,
}

export interface IAlertRuleState {
  ruleList: IAlertRuleListItem[]
  rulePagination: {
    total: number
    current: number
    pageSize: number
  }
  historyList: IAlertHistoryListItem[]
  historyPagination: {
    total: number
    current: number
    pageSize: number
  }
  activeTab: 'rules' | 'history'
}
