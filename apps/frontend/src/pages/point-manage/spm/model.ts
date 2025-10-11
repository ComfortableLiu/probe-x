import { createModel } from "@rematch/core"
import { RootModel } from "@/store/models"
import { IPointManageSpmState } from "@pages/point-manage/spm/type"
import { queryBusinessList, querySpmNodeList } from "@pages/point-manage/spm/services"
import { getParamsOrQuery } from "@utils/router"
import { IQueryTrackingSpmListReq } from "@probe-x/shared-types/src"

const initState: IPointManageSpmState = {
  page: 1,
  total: 0,
  pageSize: 1,
  trackingSpmList: [],
}

const pointManageSpmModel = createModel<RootModel>()({
  name: 'pointManageSpmModel',
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
      await dispatch.pointManageSpmModel.getBusinessLines(null)
      await dispatch.pointManageSpmModel.getSpmList(null)
    },
    async getSpmList(_, state) {
      if (!state.pointManageSpmModel?.businessList?.length) return

      const query = getParamsOrQuery()

      if (!query.businessCode) return

      const params: IQueryTrackingSpmListReq = {
        name: query.name,
        code: query.code,
        parentCode: query.businessCode,
        status: query.status,
        page: query.page || 1,
        pageSize: query.pageSize || 20,
      }
      const { data } = await querySpmNodeList(params)
      dispatch.pointManageSpmModel.updateItem({
        total: data.total,
        page: data.page,
        pageSize: data.pageSize,
        trackingSpmList: data.data,
      })
    },
    // 获取业务线
    async getBusinessLines(_, state) {
      if (state.pointManageSpmModel?.businessList?.length) return
      const res = await queryBusinessList()
      dispatch.pointManageSpmModel.updateItem({ businessList: res.data })
    },
  }),
})

export default pointManageSpmModel
