import { createModel } from "@rematch/core"
import { RootModel } from "@/store/models"
import { message } from "antd"
import { IDataAnalysisSqlState } from "@pages/data-analysis/sql/type"
import { querySql } from "@pages/data-analysis/sql/services"

const initState: IDataAnalysisSqlState = {}

const dataAnalysisSqlModel = createModel<RootModel>()({
  name: 'dataAnalysisSqlModel',
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
    // 执行 SQL 查询
    async submitQuery(payload: { sql: string }) {
      const { sql } = payload
      if (!sql?.trim()) {
        message.error('请输入 SQL 语句')
        return
      }
      const startTime = Date.now()
      try {
        const { data, code, msg } = await querySql({ sql })
        if (code !== 200) {
          message.error(msg || '查询失败')
          dispatch.dataAnalysisSqlModel.updateItem({
            error: msg || '查询失败',
          })
          return
        }
        dispatch.dataAnalysisSqlModel.updateItem({
          data,
          error: '',
          duration: Date.now() - startTime,
          updateTime: new Date(),
        })
      } catch (error: any) {
        // 请求层已统一 toast 错误信息，这里记录到页面错误区并兜底避免未捕获的 rejection
        dispatch.dataAnalysisSqlModel.updateItem({
          error: error?.msg || '查询失败，请稍后重试',
        })
        console.warn(error)
      }
    },
  }),
})

export default dataAnalysisSqlModel
