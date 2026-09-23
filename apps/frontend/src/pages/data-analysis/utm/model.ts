import { createModel } from "@rematch/core"
import { RootModel } from "@/store/models"
import { IDataAnalysisUtmState, IQuery } from "@pages/data-analysis/utm/type"
import { getParamsOrQuery } from "@utils/router"
import { isEmpty } from "@probe-x/shared-utils/src"
import {
  queryDownloadTask,
  queryUtmOptions,
  submitDownloadTask,
  submitQueryTask,
} from "@pages/data-analysis/utm/services"
import { message } from "antd"

const initState: IDataAnalysisUtmState = {}

const dataAnalysisUtmModel = createModel<RootModel>()({
  name: 'dataAnalysisUtmModel',
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
      try {
        const { data, code } = await queryUtmOptions()
        if (code !== 200) return
        dispatch.dataAnalysisUtmModel.updateItem({ utmOptions: data || [] })
      } catch (error) {
        // 请求层已统一 toast 错误信息，这里兜底避免未捕获的 rejection
        console.warn(error)
      }
    },
    // 校验query中的选项
    async checkQueryParams() {
      const {
        dimensions,
        metrics,
        utmFilters,
        globalFilters,
        timeRange,
      } = getParamsOrQuery<IQuery>()

      if (!dimensions?.length) {
        return '请选择 UTM 分组维度'
      }
      if (!metrics?.length) {
        return '请选择数据指标'
      }
      if (!timeRange?.length) {
        return '请选择时间范围'
      }
      // 每条取值筛选都要选好维度和至少一个取值
      if (utmFilters?.length && utmFilters.some(filter => !filter?.dimension || !filter.values?.length)) {
        return '请完善 UTM 取值筛选项'
      }
      if (globalFilters?.length && globalFilters.some(filter => !filter.propertyName || !filter.propertyType || !filter.compareType || isEmpty(filter.propertyValue) || (Array.isArray(filter.propertyValue) && (filter.propertyValue.length === 0 || filter.propertyValue.some(item => isEmpty(item)))))) {
        return '请完善全局筛选项'
      }
      return ''
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
    // 提交查询数据
    async submitQuery() {
      try {
        const query = getParamsOrQuery<IQuery>()
        const { data, code, msg } = await submitQueryTask(query)
        if (code !== 200) {
          message.error(msg || '查询失败')
          return
        }
        // 储存查询结果及本次查询参数快照（结果区按快照渲染，不实时跟随筛选配置）
        dispatch.dataAnalysisUtmModel.updateItem({
          data,
          updateTime: new Date(),
          querySnapshot: query,
        })
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

export default dataAnalysisUtmModel
