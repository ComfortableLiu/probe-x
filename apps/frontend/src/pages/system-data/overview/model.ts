import { createModel } from "@rematch/core"
import { RootModel } from "@/store/models"
import { ISystemDataOverviewState } from "./type"

const initState: ISystemDataOverviewState = {
}

const systemDataOverviewModel = createModel<RootModel>()({
  name: 'systemDataOverviewModel',
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

export default systemDataOverviewModel
