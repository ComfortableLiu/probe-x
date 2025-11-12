import { createModel } from "@rematch/core"
import { RootModel } from "@/store/models"
import { IDataAnalysisEventState, IQuery } from "@pages/data-analysis/event/type"
import { getParamsOrQuery } from "@utils/router"
import { isEmpty } from "@probe-x/shared-utils/src"
import { queryDownloadTask, submitDownloadTask, submitQueryTask } from "@pages/data-analysis/event/services"
import { message } from "antd"

const initState: IDataAnalysisEventState = {}

const dataAnalysisEventModel = createModel<RootModel>()({
  name: 'dataAnalysisEventModel',
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
        dimension,
        eventInfoList,
      } = getParamsOrQuery<IQuery>()
      if (!eventInfoList?.length) {
        return '请选择事件'
      }
      if (!timeRange?.length) {
        return '请选择时间范围'
      }
      if (!dimension?.length) {
        return '请选择维度项'
      }

      if (eventInfoList.some(item => !item.eventName || !item.metrics || (item.filters?.length && item.filters.some(filter => !filter.propertyName || !filter.propertyType || !filter.compareType || isEmpty(filter.propertyValue) || (Array.isArray(filter.propertyValue) && filter.propertyValue.length === 0))))) {
        return '请完善事件项'
      }

      if (globalFilters?.length && globalFilters.some(filter => !filter.propertyName || !filter.propertyType || !filter.compareType || isEmpty(filter.propertyValue) || (Array.isArray(filter.propertyValue) && filter.propertyValue.length === 0))) {
        return '请完善全局筛选项'
      }
      return ''
    },
    // 下载数据
    async downloadData() {
      const query = getParamsOrQuery<IQuery>()
      const { data, code, msg } = await submitDownloadTask(query)
      if (code !== 0 || !data?.taskId) {
        message.error(msg || '提交下载任务失败')
        return
      }
      // TODO 储存任务ID，并启动轮询
    },
    // 提交查询数据
    async submitQuery() {
      const query = getParamsOrQuery<IQuery>()
      const { data, code, msg } = await submitQueryTask(query)
      if (code !== 0 || !data) {
        message.error(msg || '查询失败')
        return
      }
      // TODO 储存查询结果
    },
    // 查询下载任务
    async queryDownloadTask() {
      const taskId = ''
      const { data, code, msg } = await queryDownloadTask({ taskId })

      if (code !== 0 || !data) {
        message.error(msg || '查询失败')
        return
      }
      return data
    },
  }),
})

export default dataAnalysisEventModel
