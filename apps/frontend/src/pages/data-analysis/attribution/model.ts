import { createModel } from "@rematch/core"
import { RootModel } from "@/store/models"
import { getParamsOrQuery } from "@utils/router"
import { message } from "antd"
import { IDataAnalysisAttributionState, IQuery } from "@pages/data-analysis/attribution/type"
import { submitQueryTask } from "@pages/data-analysis/attribution/services"

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
  }),
})

export default dataAnalysisAttributionModel
