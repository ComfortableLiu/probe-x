import { createModel } from "@rematch/core"
import { RootModel } from "@/store/models"

export const userModel = createModel<RootModel>()({
  name: 'userModel',
  state: {},
  reducers: {},
  effects: {},
})