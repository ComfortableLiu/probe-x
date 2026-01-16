import request from "@/lib/request"
import {
  IQuerySystemListReq,
  IQuerySystemListRes,
  ICreateSystemReq,
  IUpdateSystemReq,
  IDeleteSystemReq,
  ISystemOption,
} from "./type"

/**
 * 获取系统列表
 */
export function querySystemList(params: IQuerySystemListReq) {
  return request<IQuerySystemListRes>({
    url: '/system-config/system/list',
    method: 'get',
    params,
  })
}

/**
 * 创建系统
 */
export function createSystem(data: ICreateSystemReq) {
  return request({
    url: '/system-config/system/create',
    method: 'post',
    data,
  })
}

/**
 * 更新系统
 */
export function updateSystem(data: IUpdateSystemReq) {
  return request({
    url: '/system-config/system/update',
    method: 'post',
    data,
  })
}

/**
 * 删除系统
 */
export function deleteSystem(data: IDeleteSystemReq) {
  return request({
    url: '/system-config/system/delete',
    method: 'post',
    data,
  })
}

/**
 * 获取系统选项列表（用于下拉选择）
 */
export function querySystemOptions() {
  return request<ISystemOption[]>({
    url: '/system-config/system/options',
    method: 'get',
  })
}
