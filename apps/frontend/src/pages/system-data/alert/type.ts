// 告警系统相关类型定义
import {
  IAlertRule,
  IAlertHistory,
  IQueryAlertRuleListReq,
  IQueryAlertRuleListRes,
  ICreateAlertRuleReq,
  IUpdateAlertRuleReq,
  IQueryAlertHistoryListReq,
  IQueryAlertHistoryListRes,
  AlertLevel,
  AlertOperator,
} from '@probe-x/shared-types/src'

export type {
  IAlertRule,
  IAlertHistory,
  IQueryAlertRuleListReq,
  IQueryAlertRuleListRes,
  ICreateAlertRuleReq,
  IUpdateAlertRuleReq,
  IQueryAlertHistoryListReq,
  IQueryAlertHistoryListRes,
  AlertLevel,
  AlertOperator,
}

export interface IAlertState {
  ruleList: IAlertRule[]
  rulePagination: {
    total: number
    current: number
    pageSize: number
  }
  historyList: IAlertHistory[]
  historyPagination: {
    total: number
    current: number
    pageSize: number
  }
  activeTab: 'rules' | 'history'
}
