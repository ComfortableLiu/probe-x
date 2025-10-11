import { createModel } from "@rematch/core"
import { RootModel } from "@/store/models"
import { IPointManageBasicCodingState } from "@pages/point-manage/basic-coding/type"
import { createBusinessSite, queryBusinessList, updateBusinessSite } from "./services"
import { ICreateBusinessSiteReq, IUpdateBusinessSiteReq } from "@probe-x/shared-types/src"

const initState: IPointManageBasicCodingState = {}

const pointManageBasicCodingModel = createModel<RootModel>()({
  name: 'pointManageBasicCodingModel',
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
      await dispatch.pointManageBasicCodingModel.getBusinessLines(null)
    },

    // 获取业务线
    async getBusinessLines(_, state) {
      const res = await queryBusinessList()
      dispatch.pointManageBasicCodingModel.updateItem({ businessList: res.data })
    },
    // 新增业务线
    async createBusiness(payload: ICreateBusinessSiteReq) {
      await createBusinessSite(payload)
      await dispatch.pointManageBasicCodingModel.getBusinessLines(null)
    },
    // 编辑业务线
    async updateBusiness(payload: IUpdateBusinessSiteReq) {
      await updateBusinessSite(payload)
      await dispatch.pointManageBasicCodingModel.getBusinessLines(null)
    },
  }),
})

export default pointManageBasicCodingModel
