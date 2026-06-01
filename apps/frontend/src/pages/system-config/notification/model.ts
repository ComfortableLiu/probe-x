import { createModel } from "@rematch/core"
import { INotificationManageState } from "./type"
import { RootModel } from "@/store/models"
import { queryNotificationList, createNotification, updateNotification, deleteNotification, testSendNotification } from "./services"
import { ICreateNotificationReq, IUpdateNotificationReq } from "./type"
import { getParamsOrQuery } from "@utils/router"
import { message } from "antd"

const initState: INotificationManageState = {
  notificationList: [],
  pagination: {
    total: 0,
    current: 1,
    pageSize: 20,
  },
}

const systemConfigNotificationModel = createModel<RootModel>()({
  name: 'systemConfigNotificationModel',
  state: initState,
  reducers: {
    updateItem(state, payload) {
      return { ...state, ...payload }
    },
  },
  effects: (dispatch) => ({
    async getNotificationList() {
      const payload = getParamsOrQuery()
      const params = {
        notificationName: payload.notificationName,
        notificationType: payload.notificationType,
        isEnable: payload.isEnable !== undefined ? payload.isEnable === 'true' || payload.isEnable === true : undefined,
        page: payload.page || 1,
        pageSize: payload.pageSize || 20,
      }
      const { data } = await queryNotificationList(params)
      dispatch.systemConfigNotificationModel.updateItem({
        notificationList: data.data || [],
        pagination: {
          total: data.total || 0,
          current: data.page || params.page || 1,
          pageSize: data.pageSize || params.pageSize || 20,
        },
      })
    },
    async createNotification(payload: ICreateNotificationReq) {
      await createNotification(payload)
      message.success('创建通知配置成功')
      await dispatch.systemConfigNotificationModel.getNotificationList()
    },
    async updateNotification(payload: IUpdateNotificationReq) {
      await updateNotification(payload)
      message.success('更新通知配置成功')
      await dispatch.systemConfigNotificationModel.getNotificationList()
    },
    async deleteNotification(id: number) {
      await deleteNotification(id)
      message.success('删除通知配置成功')
      await dispatch.systemConfigNotificationModel.getNotificationList()
    },
    async testSend(id: number) {
      try {
        const { data } = await testSendNotification(id)
        if (data?.success) {
          message.success(data.message || '测试发送成功')
        } else {
          message.error(data?.message || '测试发送失败')
        }
      } catch {
        message.error('测试发送失败')
      }
    },
  }),
})

export default systemConfigNotificationModel
