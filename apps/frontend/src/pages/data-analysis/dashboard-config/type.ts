import {
  IDashboard,
  DashboardType,
  AnalysisType,
  ICreateDashboardReq,
  IUpdateDashboardReq,
  IQueryDashboardListReq,
} from "@probe-x/shared-types/src"

export interface IDashboardConfigState {
  dashboardList: IDashboard[]
  pagination: {
    total: number
    current: number
    pageSize: number
  }
}

// 重新导出类型和枚举
export type { IDashboard, ICreateDashboardReq, IUpdateDashboardReq, IQueryDashboardListReq }
// 枚举需要直接导出，不能使用 export type
export { DashboardType, AnalysisType }
