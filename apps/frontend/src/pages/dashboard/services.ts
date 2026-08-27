import request from "@/lib/request"
import {
  IDashboardDataRes,
  IDashboardListRes,
  IQueryDashboardDataReq,
  IQueryDashboardListReq,
} from "@probe-x/shared-types/src"

/**
 * 查询看板列表
 * 不传 type 时返回「我的个人看板 + 有权限的公共看板」
 */
export function queryDashboardList(data?: IQueryDashboardListReq) {
  return request<IDashboardListRes>({
    url: '/dashboard/list',
    method: 'get',
    params: data,
  })
}

/**
 * 查询单个看板的数据
 */
export function queryDashboardData(data: IQueryDashboardDataReq) {
  return request<IDashboardDataRes>({
    url: '/dashboard/data',
    method: 'post',
    data,
  })
}
