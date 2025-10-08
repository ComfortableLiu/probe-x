import { Models } from "@rematch/core"
import { appModel } from "./app/model"
import { userModel } from "./user/model"
import { staticModel } from "@/store/models/static/model"
import pointManageEventModel from "@pages/point-manage/event/model"
import pointManagePropertyModel from "@pages/point-manage/property/model"

export interface RootModel extends Models<RootModel> {
  appModel: typeof appModel
  userModel: typeof userModel
  staticModel: typeof staticModel
  pointManageEventModel: typeof pointManageEventModel
  pointManagePropertyModel: typeof pointManagePropertyModel
}

export const models: RootModel = {
  appModel,
  userModel,
  staticModel,
  pointManageEventModel,
  pointManagePropertyModel,
}
