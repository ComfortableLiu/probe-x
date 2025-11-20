import { createModel } from "@rematch/core"
import { RootModel } from "@/store/models"
import { IQuery } from "@pages/data-analysis/event/type"
import { getParamsOrQuery } from "@utils/router"
import { isEmpty } from "@probe-x/shared-utils/src"
import { submitQueryTask } from "@pages/data-analysis/event/services"
import { message } from "antd"
import { IDataAnalysisFunnelState } from "@pages/data-analysis/funnel/type"

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
      const query = getParamsOrQuery<IQuery>()
      const { data, code, msg } = await submitQueryTask(query)
      if (code !== 200) {
        message.error(msg || '查询失败')
        return
      }
      // 储存查询结果
      dispatch.dataAnalysisFunnelModel.updateItem({ data })
    },
  }),
})

export default dataAnalysisFunnelModel
