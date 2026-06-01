import request from "@/lib/request"
import {
  IQueryProjectListReq,
  IQueryProjectListRes,
  ICreateProjectReq,
  IUpdateProjectReq,
  IProjectMemberItem,
} from "./type"

export function queryProjectList(params: IQueryProjectListReq) {
  return request<IQueryProjectListRes>({
    url: '/project/list',
    method: 'get',
    params,
  })
}

export function createProject(data: ICreateProjectReq) {
  return request({
    url: '/project/create',
    method: 'post',
    data,
  })
}

export function updateProject(data: IUpdateProjectReq) {
  return request({
    url: '/project/update',
    method: 'post',
    data,
  })
}

export function deleteProject(id: number) {
  return request({
    url: '/project/delete',
    method: 'post',
    data: { id },
  })
}

export function getProjectMembers(projectId: number) {
  return request<IProjectMemberItem[]>({
    url: `/project/${projectId}/members`,
    method: 'get',
  })
}

export function addProjectMembers(projectId: number, userIds: number[]) {
  return request({
    url: `/project/${projectId}/members/add`,
    method: 'post',
    data: { userIds },
  })
}

export function removeProjectMember(projectId: number, userId: number) {
  return request({
    url: `/project/${projectId}/members/remove`,
    method: 'post',
    data: { userId },
  })
}
