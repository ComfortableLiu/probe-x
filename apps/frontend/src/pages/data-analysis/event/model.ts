import { createModel } from "@rematch/core"
import { RootModel } from "@/store/models"
import { IDataAnalysisEventState, IQuery } from "@pages/data-analysis/event/type"
import { getParamsOrQuery } from "@utils/router"
import { isEmpty } from "@probe-x/shared-utils/src"

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
      const {
        globalFilters,
        timeRange,
        dimension,
        eventInfoList,
      } = getParamsOrQuery<IQuery>()
      // TODO 异步下载
      console.log('下载数据', globalFilters, timeRange, dimension, eventInfoList)
    },
    // 提交查询数据
    async submitQuery() {
      const {
        globalFilters,
        timeRange,
        dimension,
        eventInfoList,
      } = getParamsOrQuery<IQuery>()
      // TODO 接口查询
      console.log('查询数据', globalFilters, timeRange, dimension, eventInfoList)
    },
  }),
})

export default dataAnalysisEventModel
