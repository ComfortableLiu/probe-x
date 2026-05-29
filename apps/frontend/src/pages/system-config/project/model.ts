import { createModel } from "@rematch/core"
import { IProjectManageState } from "./type"
import { RootModel } from "@/store/models"
import { queryProjectList, createProject, updateProject, deleteProject, getProjectMembers, addProjectMembers, removeProjectMember } from "./services"
import { ICreateProjectReq, IUpdateProjectReq } from "./type"
import { getParamsOrQuery } from "@utils/router"
import { message } from "antd"

const initState: IProjectManageState = {
  projectList: [],
  pagination: {
    total: 0,
    current: 1,
    pageSize: 20,
  },
  members: [],
  membersLoading: false,
}

const systemConfigProjectModel = createModel<RootModel>()({
  name: 'systemConfigProjectModel',
  state: initState,
  reducers: {
    updateItem(state, payload) {
      return { ...state, ...payload }
    },
  },
  effects: (dispatch) => ({
    async getProjectList() {
      const payload = getParamsOrQuery()
      const params = {
        projectName: payload.projectName,
        projectKey: payload.projectKey,
        isEnable: payload.isEnable !== undefined ? payload.isEnable === 'true' || payload.isEnable === true : undefined,
        page: payload.page || 1,
        pageSize: payload.pageSize || 20,
      }
      const { data } = await queryProjectList(params)
      dispatch.systemConfigProjectModel.updateItem({
        projectList: data.data || [],
        pagination: {
          total: data.total || 0,
          current: data.page || params.page || 1,
          pageSize: data.pageSize || params.pageSize || 20,
        },
      })
    },
    async createProject(payload: ICreateProjectReq) {
      await createProject(payload)
      message.success('创建项目成功')
      await dispatch.systemConfigProjectModel.getProjectList()
    },
    async updateProject(payload: IUpdateProjectReq) {
      await updateProject(payload)
      message.success('更新项目成功')
      await dispatch.systemConfigProjectModel.getProjectList()
    },
    async deleteProject(id: number) {
      await deleteProject(id)
      message.success('删除项目成功')
      await dispatch.systemConfigProjectModel.getProjectList()
    },
    async getProjectMembers(projectId: number) {
      dispatch.systemConfigProjectModel.updateItem({ membersLoading: true })
      try {
        const { data } = await getProjectMembers(projectId)
        dispatch.systemConfigProjectModel.updateItem({ members: data || [], membersLoading: false })
      } catch {
        dispatch.systemConfigProjectModel.updateItem({ membersLoading: false })
      }
    },
    async addMembers(payload: { projectId: number; userIds: number[] }) {
      await addProjectMembers(payload.projectId, payload.userIds)
      message.success('添加成员成功')
      await dispatch.systemConfigProjectModel.getProjectMembers(payload.projectId)
    },
    async removeMember(payload: { projectId: number; userId: number }) {
      await removeProjectMember(payload.projectId, payload.userId)
      message.success('移除成员成功')
      await dispatch.systemConfigProjectModel.getProjectMembers(payload.projectId)
    },
  }),
})

export default systemConfigProjectModel
