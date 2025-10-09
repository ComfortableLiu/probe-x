import { createModel } from "@rematch/core"
import { RootModel } from "@/store/models"
import { IPointManageSpmState } from "@pages/point-manage/spm/type"

const initState: IPointManageSpmState = {
  page: 1,
  total: 0,
  pageSize: 1,
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
  }),
})

export default pointManageSpmModel
