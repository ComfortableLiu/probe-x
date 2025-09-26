import { Models } from "@rematch/core"
import { appModel } from "./app/model"
import { userModel } from "./user/model"


export interface RootModel extends Models<RootModel> {
  appModel: typeof appModel
  userModel: typeof userModel
}

export const models: RootModel = {
  appModel,
  userModel,
}
