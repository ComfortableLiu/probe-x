import request from "@/lib/request"
import {
  IQueryUserListReq,
  IQueryUserListRes,
  ICreateUserReq,
  IUpdateUserReq,
  IResetPasswordReq,
  IAssignRolesReq,
  IRoleOption,
} from "./type"

/**
 * 获取用户列表
 */
export function queryUserList(params: IQueryUserListReq) {
  return request<IQueryUserListRes>({
    url: '/system-config/user/list',
    method: 'get',
    params,
  })
}

/**
 * 创建用户
 */
export function createUser(data: ICreateUserReq) {
  return request({
    url: '/system-config/user/create',
    method: 'post',
    data,
  })
}

/**
 * 更新用户
 */
export function updateUser(data: IUpdateUserReq) {
  return request({
    url: '/system-config/user/update',
    method: 'post',
    data,
  })
}

/**
 * 删除用户
 */
export function deleteUser(userId: number) {
  return request({
    url: '/system-config/user/delete',
    method: 'post',
    data: { userId },
  })
}

/**
 * 重置密码
 */
export function resetPassword(data: IResetPasswordReq) {
  return request({
    url: '/system-config/user/resetPassword',
    method: 'post',
    data,
  })
}

/**
 * 分配角色
 */
export function assignRoles(data: IAssignRolesReq) {
  return request({
    url: '/system-config/user/assignRoles',
    method: 'post',
    data,
  })
}

/**
 * 获取角色列表
 */
export function queryRoleList() {
  return request<IRoleOption[]>({
    url: '/system-config/role/list',
    method: 'get',
  })
}

