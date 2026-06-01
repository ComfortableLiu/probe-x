import { createModel } from "@rematch/core"
import { RootModel } from "@/store/models"
import { IDataAnalysisFreeState, IQuery } from "@pages/data-analysis/free/type"
import { getParamsOrQuery } from "@utils/router"
import { isEmpty } from "@probe-x/shared-utils/src"
import { submitFreeQueryTask } from "@pages/data-analysis/free/services"
import { message } from "antd"

const initState: IDataAnalysisFreeState = {}

const dataAnalysisFreeModel = createModel<RootModel>()({
  name: 'dataAnalysisFreeModel',
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

      if (eventInfoList.some(item => !item.eventName || !item.metrics || (item.filters?.length && item.filters.some(filter => !filter.propertyName || !filter.propertyType || !filter.compareType || isEmpty(filter.propertyValue) || (Array.isArray(filter.propertyValue) && (filter.propertyValue.length === 0 || filter.propertyValue.some(item => isEmpty(item)))))))) {
        return '请完善事件项'
      }

      if (globalFilters?.length && globalFilters.some(filter => !filter.propertyName || !filter.propertyType || !filter.compareType || isEmpty(filter.propertyValue) || (Array.isArray(filter.propertyValue) && (filter.propertyValue.length === 0 || filter.propertyValue.some(item => isEmpty(item)))))) {
        return '请完善全局筛选项'
      }
      return ''
    },
    // 提交查询数据
    async submitQuery() {
      try {
        const query = getParamsOrQuery<IQuery>()
        const { data, code, msg } = await submitFreeQueryTask(query)
        if (code !== 200) {
          message.error(msg || '查询失败')
          return
        }
        // 储存查询结果
        dispatch.dataAnalysisFreeModel.updateItem({
          data,
          updateTime: new Date(),
        })
      } catch (error) {
        message.error('查询失败，请稍后重试')
      }
    },
  }),
})

export default dataAnalysisFreeModel
