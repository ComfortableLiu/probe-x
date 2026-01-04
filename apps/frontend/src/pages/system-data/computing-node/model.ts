import { createModel } from "@rematch/core"
import { RootModel } from "@/store/models"
import { ISystemDataComputingNodeState } from "./type"

const initState: ISystemDataComputingNodeState = {
}

const SystemDataComputingNodeModel = createModel<RootModel>()({
  name: 'SystemDataComputingNodeModel',
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

export default SystemDataComputingNodeModel
