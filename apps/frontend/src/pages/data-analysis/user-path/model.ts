import { createModel } from "@rematch/core"
import { RootModel } from "@/store/models"
import { getParamsOrQuery } from "@utils/router"
import { message } from "antd"
import { IDataAnalysisUserPathState, IQuery } from "@pages/data-analysis/user-path/type"
import { queryDownloadTask, submitDownloadTask, submitQueryTask } from "@pages/data-analysis/user-path/services"

const initState: IDataAnalysisUserPathState = {}

const dataAnalysisUserPathModel = createModel<RootModel>()({
  name: 'dataAnalysisUserPathModel',
  state: initState,
  reducers: {
    updateItem(state, payload) {
      return {
        ...state,
        ...payload,
      }
    },
  },
  effects: (dispatch) => ({
    async init() {
      await Promise.all([
        dispatch.pointModel.getEventList(),
        dispatch.pointModel.getPropertyList(),
      ])
    },
    // 校验query中的选项
    async checkQueryParams() {
      const {
        timeRange,
        startEvent,
        endEvent,
        eventList,
      } = getParamsOrQuery<IQuery>()
      if (!timeRange?.length) {
        return '请选择时间范围'
      }
      if (!eventList?.length) {
        return '请选择事件'
      }

      if (eventList.length < 2) {
        return "请至少选择两个事件"
      }

      if (!startEvent && !endEvent) {
        return "请选择开始或结束事件"
      }

      if (!eventList.includes(startEvent) && !eventList.includes(endEvent)) {
        return "开始或结束事件仅可设定已选择的事件"
      }

      return ''
    },

    // 提交查询数据
    async submitQuery() {
      try {
        const query = getParamsOrQuery<IQuery>()
        const { data, code, msg } = await submitQueryTask(query)
        if (code !== 200) {
          message.error(msg || '查询失败')
          return
        }
        // 储存查询结果
        dispatch.dataAnalysisUserPathModel.updateItem({
          data,
          updateTime: new Date(),
        })
      } catch (error) {
        // 请求层已统一 toast 错误信息，这里兜底避免未捕获的 rejection
        console.warn(error)
      }
    },
    // 下载数据
    async downloadData() {
      try {
        const query = getParamsOrQuery<IQuery>()
        const { data, code, msg } = await submitDownloadTask(query)
        if (code !== 200 || !data?.taskId) {
          message.error(msg || '提交下载任务失败')
          return
        }
        return data.taskId
      } catch (error) {
        // 请求层已统一 toast 错误信息，这里兜底避免未捕获的 rejection
        console.warn(error)
      }
    },
    // 查询下载任务
    async queryDownloadTask({ taskId }: { taskId: string }) {
      try {
        if (!taskId) return null
        const { data, code, msg } = await queryDownloadTask({ taskId })

        if (code !== 200 || !data) {
          message.error(msg || '查询失败')
          return
        }
        return data
      } catch (error) {
        // 请求层已统一 toast 错误信息，这里兜底避免未捕获的 rejection
        console.warn(error)
      }
    },
  }),
})

export default dataAnalysisUserPathModel
