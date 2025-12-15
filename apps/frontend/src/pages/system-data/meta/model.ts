import { createModel } from "@rematch/core"
import { RootModel } from "@/store/models"
import { ISystemDataMetaState } from "./type"

const initState: ISystemDataMetaState = {
}

const systemDataMetaModel = createModel<RootModel>()({
  name: 'systemDataMetaModel',
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

export default systemDataMetaModel
