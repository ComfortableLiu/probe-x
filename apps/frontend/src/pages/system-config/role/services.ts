import request from "@/lib/request"
import {
  IQueryRoleListReq,
  IQueryRoleListRes,
  ICreateRoleReq,
  IUpdateRoleReq,
  IDeleteRoleReq,
  IAssignPermissionsReq,
  IQueryPermissionListRes,
} from "./type"

/**
 * 获取角色列表（管理页面）
 */
export function queryRoleList(params: IQueryRoleListReq) {
  return request<IQueryRoleListRes>({
    url: '/system-config/role/manage/list',
    method: 'get',
    params,
  })
}

/**
 * 创建角色
 */
export function createRole(data: ICreateRoleReq) {
  return request({
    url: '/system-config/role/create',
    method: 'post',
    data,
  })
}

/**
 * 更新角色
 */
export function updateRole(data: IUpdateRoleReq) {
  return request({
    url: '/system-config/role/update',
    method: 'post',
    data,
  })
}

/**
 * 删除角色
 */
export function deleteRole(data: IDeleteRoleReq) {
  return request({
    url: '/system-config/role/delete',
    method: 'post',
    data,
  })
}

/**
 * 分配权限
 */
export function assignPermissions(data: IAssignPermissionsReq) {
  return request({
    url: '/system-config/role/assignPermissions',
    method: 'post',
    data,
  })
}

/**
 * 获取权限列表（全局）
 */
export function queryPermissionList() {
  return request<IQueryPermissionListRes>({
    url: '/system-config/permission/list',
    method: 'get',
  })
}

/**
 * 获取角色的权限ID列表
 */
export function queryRolePermissionIds(roleId: number) {
  return request<number[]>({
    url: '/system-config/role/permissionIds',
    method: 'get',
    params: { roleId },
  })
}

