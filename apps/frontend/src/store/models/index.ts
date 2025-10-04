import { Models } from "@rematch/core"
import { appModel } from "./app/model"
import { userModel } from "./user/model"
import pointManageEventModel from "@pages/point-manage/event/model"

export interface RootModel extends Models<RootModel> {
  appModel: typeof appModel
  userModel: typeof userModel
  pointManageEventModel: typeof pointManageEventModel
}

export const models: RootModel = {
  appModel,
  userModel,
  pointManageEventModel,
}
