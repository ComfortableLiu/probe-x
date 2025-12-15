import { createModel } from "@rematch/core"
import { RootModel } from "@/store/models"
import { ISystemDataComputingNodeState } from "./type"

const initState: ISystemDataComputingNodeState = {
}

const ISystemDataComputingNodeState = createModel<RootModel>()({
  name: 'ISystemDataComputingNodeState',
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

export default ISystemDataComputingNodeState
