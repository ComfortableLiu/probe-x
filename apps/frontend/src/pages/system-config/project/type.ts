// 项目管理相关类型定义
import {
  IProjectListItem,
  IQueryProjectListReq,
  IQueryProjectListRes,
  ICreateProjectReq,
  IUpdateProjectReq,
  IProjectMemberItem,
} from '@probe-x/shared-types/src'

export type {
  IProjectListItem,
  IQueryProjectListReq,
  IQueryProjectListRes,
  ICreateProjectReq,
  IUpdateProjectReq,
  IProjectMemberItem,
}

export interface IProjectManageState {
  projectList: IProjectListItem[]
  pagination: {
    total: number
    current: number
    pageSize: number
  }
  members: IProjectMemberItem[]
  membersLoading: boolean
}
