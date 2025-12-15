import { createModel } from "@rematch/core"
import { RootModel } from "@/store/models"
import { ISystemDataAnalysisState } from "./type"

const initState: ISystemDataAnalysisState = {
}

const analysisModel = createModel<RootModel>()({
  name: 'analysisModel',
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

export default analysisModel
