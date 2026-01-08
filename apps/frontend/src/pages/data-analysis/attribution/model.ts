import { createModel } from "@rematch/core"
import { RootModel } from "@/store/models"
import { getParamsOrQuery } from "@utils/router"
import { message } from "antd"
import { IDataAnalysisAttributionState, IQuery } from "@pages/data-analysis/attribution/type"
import { queryDownloadTask, submitDownloadTask, submitQueryTask } from "@pages/data-analysis/attribution/services"

const initState: IDataAnalysisAttributionState = {}

const dataAnalysisAttributionModel = createModel<RootModel>()({
  name: 'dataAnalysisAttributionModel',
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
        globalFilters,
        timeRange,
      } = getParamsOrQuery<IQuery>()

      // if (!timeRange?.length) {
      //   return '请选择时间范围'
      // }
      // if (!dimension?.length) {
      //   return '请选择维度项'
      // }
      //
      // if (globalFilters?.length && globalFilters.some(filter => !filter.propertyName || !filter.propertyType || !filter.compareType || isEmpty(filter.propertyValue) || (Array.isArray(filter.propertyValue) && (filter.propertyValue.length === 0 || filter.propertyValue.some(item => isEmpty(item)))))) {
      //   return '请完善全局筛选项'
      // }
      return ''
    },
    // 提交查询数据
    async submitQuery() {
      const query = getParamsOrQuery<IQuery>()
      const { data, code, msg } = await submitQueryTask(query)
      if (code !== 200) {
        message.error(msg || '查询失败')
        return
      }
      // 储存查询结果
      dispatch.dataAnalysisAttributionModel.updateItem({
        data,
        updateTime: new Date(),
      })
    },
    // 下载数据
    async downloadData() {
      const query = getParamsOrQuery<IQuery>()
      const { data, code, msg } = await submitDownloadTask(query)
      if (code !== 200 || !data?.taskId) {
        message.error(msg || '提交下载任务失败')
        return
      }
      return data.taskId
    },
    // 查询下载任务
    async queryDownloadTask({ taskId }: { taskId: string }) {
      if (!taskId) return null
      const { data, code, msg } = await queryDownloadTask({ taskId })

      if (code !== 200 || !data) {
        message.error(msg || '查询失败')
        return
      }
      return data
    },
  }),
})

export default dataAnalysisAttributionModel
