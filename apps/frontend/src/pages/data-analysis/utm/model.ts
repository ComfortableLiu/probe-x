import { createModel } from "@rematch/core"
import { RootModel } from "@/store/models"
import { IDataAnalysisUtmState, IQuery } from "@pages/data-analysis/utm/type"
import { getParamsOrQuery } from "@utils/router"
import { isEmpty } from "@probe-x/shared-utils/src"
import {
  IResolveUtmOptionsReq,
  IUtmOptionItem,
  utmDimAlias,
} from "@probe-x/shared-types/src"
import {
  queryDownloadTask,
  resolveUtmOptions,
  submitDownloadTask,
  submitQueryTask,
} from "@pages/data-analysis/utm/services"
import { message } from "antd"

const initState: IDataAnalysisUtmState = {
  // 条目池按需累积：下拉分页/搜索只维护各自列表，池只由 resolveOptions 补充
  utmOptions: [],
}

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
    // 把按需解析到的条目并入池，按 id 去重；在 reducer 里合并，并发 resolve 不会互相覆盖
    appendUtmOptions(state, payload: IUtmOptionItem[]) {
      const pool = state.utmOptions || []
      const ids = new Set(pool.map(item => item.id))
      const merged = [...pool]
      ;(payload || []).forEach(item => {
        if (ids.has(item.id)) return
        ids.add(item.id)
        merged.push(item)
      })
      return {
        ...state,
        utmOptions: merged,
      }
    },
  },
  effects: (dispatch) => ({
    // 按需批量解析 (维度, 取值) 的别名/统计并累积进条目池；池中已有或入参为空的直接跳过
    async resolveOptions(items: IResolveUtmOptionsReq['items'], rootState) {
      try {
        const pool = rootState.dataAnalysisUtmModel.utmOptions || []
        const inPool = new Set(pool.map(item => `${item.dimension}\x00${item.value}`))
        const seen = new Set<string>()
        const missing: IResolveUtmOptionsReq['items'] = []
        ;(items || []).forEach(item => {
          if (!item?.dimension || !item?.value) return
          const key = `${item.dimension}\x00${item.value}`
          if (inPool.has(key) || seen.has(key)) return
          seen.add(key)
          missing.push({ dimension: item.dimension, value: item.value })
        })
        if (!missing.length) return
        const { data, code } = await resolveUtmOptions({ items: missing })
        if (code !== 200 || !data?.length) return
        dispatch.dataAnalysisUtmModel.appendUtmOptions(data)
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
      // 每条取值筛选都要选好维度；精确匹配至少一个取值，正则匹配必须填正则
      if (utmFilters?.length && utmFilters.some(filter => !filter?.dimension ||
        (filter.matchType === 'REGEX' ? !filter.pattern?.trim() : !filter.values?.length))) {
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
        // 结果行里出现的取值按需解析别名，补进条目池供表格/图表展示
        const items: IResolveUtmOptionsReq['items'] = []
        const seen = new Set<string>()
        ;(query.dimensions || []).forEach(dimension => {
          const column = utmDimAlias(dimension)
          ;(data?.rows || []).forEach(row => {
            const value = row[column]
            if (typeof value !== 'string' || !value) return
            const key = `${dimension}\x00${value}`
            if (seen.has(key)) return
            seen.add(key)
            items.push({ dimension, value })
          })
        })
        dispatch.dataAnalysisUtmModel.resolveOptions(items)
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
