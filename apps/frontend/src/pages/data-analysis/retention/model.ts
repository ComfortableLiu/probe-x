import { createModel } from "@rematch/core"
import { RootModel } from "@/store/models"
import { getParamsOrQuery } from "@utils/router"
import { isEmpty } from "@probe-x/shared-utils/src"
import { message } from "antd"
import { IAttributionAnalysisFilter, IRetentionAnalysisReq } from "@probe-x/shared-types/src"
import { IDataAnalysisRetentionState, IQuery } from "@pages/data-analysis/retention/type"
import { queryDownloadTask, submitDownloadTask, submitQueryTask } from "@pages/data-analysis/retention/services"

const initState: IDataAnalysisRetentionState = {}

// 筛选项是否未填写完整（事件筛选与全局筛选共用）
function isFilterIncomplete(filter: IAttributionAnalysisFilter) {
  return !filter.propertyName || !filter.propertyType || !filter.compareType || isEmpty(filter.propertyValue) || (Array.isArray(filter.propertyValue) && (filter.propertyValue.length === 0 || filter.propertyValue.some(item => isEmpty(item))))
}

const dataAnalysisRetentionModel = createModel<RootModel>()({
  name: 'dataAnalysisRetentionModel',
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
        startEvent,
        returnEvent,
        timeRange,
        retentionWindows,
        granularity,
        globalFilters,
      } = getParamsOrQuery<IQuery>()
      if (!startEvent?.eventName) {
        return '请选择起始事件'
      }
      if (!returnEvent?.eventName) {
        return '请选择回访事件'
      }
      if (!retentionWindows?.length) {
        return '请选择留存窗口'
      }
      if (retentionWindows.some(day => !Number.isInteger(day) || day < 1 || day > 90)) {
        return '留存窗口需为1-90的正整数'
      }
      if (!timeRange?.length) {
        return '请选择时间范围'
      }
      if (!granularity) {
        return '请选择时间粒度'
      }
      // 维度非必填，默认按「总体」统计

      if ([startEvent, returnEvent].some(event => event.filters?.length && event.filters.some(isFilterIncomplete))) {
        return '请完善事件项'
      }

      if (globalFilters?.length && globalFilters.some(isFilterIncomplete)) {
        return '请完善全局筛选项'
      }
      return ''
    },
    // 提交查询数据
    async submitQuery() {
      try {
        const query = getParamsOrQuery<IQuery>()
        // checkQueryParams 通过后必填项已齐全，这里直接按完整入参提交
        const { data, code, msg } = await submitQueryTask(query as IRetentionAnalysisReq)
        if (code !== 200) {
          message.error(msg || '查询失败')
          return
        }
        // 储存查询结果及本次查询参数快照（结果区按快照渲染，不实时跟随筛选配置）
        dispatch.dataAnalysisRetentionModel.updateItem({
          data,
          updateTime: new Date(),
          querySnapshot: query,
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
        const { data, code, msg } = await submitDownloadTask(query as IRetentionAnalysisReq)
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

export default dataAnalysisRetentionModel
