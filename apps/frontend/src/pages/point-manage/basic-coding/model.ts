import { createModel } from "@rematch/core"
import { RootModel } from "@/store/models"
import { IPointManageBasicCodingState } from "@pages/point-manage/basic-coding/type"

const initState: IPointManageBasicCodingState = {
}

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
  }),
})

export default pointManageBasicCodingModel
