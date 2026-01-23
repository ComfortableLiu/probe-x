import request from "@/lib/request"
import {
  ICreateDashboardReq,
  IUpdateDashboardReq,
  IQueryDashboardListReq,
  IDashboard,
  IDashboardListRes,
  IQueryDashboardDataReq,
  IDashboardDataRes,
  IConvertToPublicDashboardReq,
} from "@probe-x/shared-types/src"

/**
 * 创建看板
 */
export function createDashboard(data: ICreateDashboardReq) {
  return request<IDashboard>({
    url: '/dashboard/create',
    method: 'post',
    data,
  })
}

/**
 * 更新看板
 */
export function updateDashboard(data: IUpdateDashboardReq) {
  return request<IDashboard>({
    url: '/dashboard/update',
    method: 'post',
    data,
  })
}

/**
 * 删除看板
 */
export function deleteDashboard(id: number) {
  return request<void>({
    url: '/dashboard/delete',
    method: 'delete',
    params: { id },
  })
}

/**
 * 查询看板列表
 */
export function queryDashboardList(data?: IQueryDashboardListReq) {
  return request<IDashboardListRes>({
    url: '/dashboard/list',
    method: 'get',
    params: data,
  })
}

/**
 * 查询看板数据
 */
export function queryDashboardData(data: IQueryDashboardDataReq) {
  return request<IDashboardDataRes>({
    url: '/dashboard/data',
    method: 'post',
    data,
  })
}

/**
 * 转换为公共看板
 */
export function convertToPublicDashboard(data: IConvertToPublicDashboardReq) {
  return request<IDashboard>({
    url: '/dashboard/convert-to-public',
    method: 'post',
    data,
  })
}
