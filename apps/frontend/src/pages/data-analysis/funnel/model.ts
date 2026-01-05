import { createModel } from "@rematch/core"
import { RootModel } from "@/store/models"
import { getParamsOrQuery } from "@utils/router"
import { isEmpty } from "@probe-x/shared-utils/src"
import { message } from "antd"
import { IDataAnalysisFunnelState, IQuery } from "@pages/data-analysis/funnel/type"
import { windowPeriodValue } from "@pages/data-analysis/components/WindowPeriod/utils"
import { queryDownloadTask, submitDownloadTask, submitQueryTask } from "@pages/data-analysis/funnel/services"

const initState: IDataAnalysisFunnelState = {}

const dataAnalysisFunnelModel = createModel<RootModel>()({
  name: 'dataAnalysisFunnelModel',
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
        funnelType,
        funnelInfoList,
        windowPeriod,
      } = getParamsOrQuery<IQuery>()
      if (!funnelInfoList?.length) {
        return '请选择漏斗数据'
      }
      if (!timeRange?.length) {
        return '请选择时间范围'
      }
      if (!dimension?.length) {
        return '请选择维度项'
      }

      if (funnelInfoList.map(item => item.eventInfo).some(item => !item.eventName || !item.metrics || (item.filters?.length && item.filters.some(filter => !filter.propertyName || !filter.propertyType || !filter.compareType || isEmpty(filter.propertyValue) || (Array.isArray(filter.propertyValue) && (filter.propertyValue.length === 0 || filter.propertyValue.some(item => isEmpty(item)))))))) {
        return '请完善事件项'
      }

      if (globalFilters?.length && globalFilters.some(filter => !filter.propertyName || !filter.propertyType || !filter.compareType || isEmpty(filter.propertyValue) || (Array.isArray(filter.propertyValue) && (filter.propertyValue.length === 0 || filter.propertyValue.some(item => isEmpty(item)))))) {
        return '请完善全局筛选项'
      }
      if (!funnelType) {
        return '请选择漏斗类型'
      }
      if (!windowPeriod) {
        return '请选择时间窗口'
      }
      const m = windowPeriodValue(windowPeriod.unit, 'm', windowPeriod.value)
      if (m < 1 || m > 3650 * 24 * 60) {
        return '时间窗口范围1分钟-3650天'
      }
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
      dispatch.dataAnalysisFunnelModel.updateItem({
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

export default dataAnalysisFunnelModel
