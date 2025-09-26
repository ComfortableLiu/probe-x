import { createModel } from "@rematch/core"
import { RootModel } from "@/store/models"

export const appModel = createModel<RootModel>()({
  name: 'appModel',
  state: {},
  reducers: {},
  effects: {},
})