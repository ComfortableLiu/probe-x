import { createModel } from "@rematch/core"
import { RootModel } from "@/store/models"
import { getParamsOrQuery } from "@utils/router"
import { message } from "antd"
import { IDataAnalysisAttributionState, IModelComparisonItem, IQuery } from "@pages/data-analysis/attribution/type"
import { queryDownloadTask, submitDownloadTask, submitQueryTask } from "@pages/data-analysis/attribution/services"
import { AttributionModelEnum } from "@probe-x/shared-types/src"

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
        attributionModel,
        targetMetric,
        timeRange,
        attributionEvent,
      } = getParamsOrQuery<IQuery>()

      if (!attributionModel) {
        return '请选择归因模型'
      }
      if (!targetMetric?.eventInfo?.eventName || !targetMetric?.eventInfo?.metrics) {
        return '请选择转化目标指标'
      }
      if (!timeRange?.length) {
        return '请选择时间范围'
      }
      if (!attributionEvent?.length) {
        return '请选择归因事件'
      }
      if (attributionEvent.some(item => !item.eventInfo?.eventName || !item.eventInfo?.metrics)) {
        return '请完善归因事件'
      }
      return ''
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
        // 储存查询结果（同时清空模型对比数据）
        dispatch.dataAnalysisAttributionModel.updateItem({
          data,
          updateTime: new Date(),
          modelComparisonData: undefined,
        })
      } catch (error) {
        // 请求层已统一 toast 错误信息，这里兜底避免未捕获的 rejection
        console.warn(error)
      }
    },
    // 并行查询所有归因模型数据（用于模型对比图）
    async queryAllModels() {
      const query = getParamsOrQuery<IQuery>()
      const models = [
        AttributionModelEnum.FIRST_TOUCH,
        AttributionModelEnum.LAST_TOUCH,
        AttributionModelEnum.LINEAR,
        AttributionModelEnum.POSITION,
        AttributionModelEnum.TIME_DECAY,
      ]

      try {
        const results = await Promise.allSettled(
          models.map(async (model) => {
            const { data, code } = await submitQueryTask({
              ...query,
              attributionModel: model,
            })
            if (code !== 200 || !data) return null
            return { model, data } as IModelComparisonItem
          })
        )

        const validResults = results
          .filter((r): r is PromiseFulfilledResult<IModelComparisonItem | null> => r.status === 'fulfilled')
          .map(r => r.value)
          .filter(Boolean) as IModelComparisonItem[]

        dispatch.dataAnalysisAttributionModel.updateItem({
          modelComparisonData: validResults,
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

export default dataAnalysisAttributionModel
