import { Models } from "@rematch/core"
import { appModel } from "./app/model"
import { userModel } from "./user/model"
import { staticModel } from "@/store/models/static/model"
import { pointModel } from "@/store/models/point/model"
import pointManageEventModel from "@pages/point-manage/event/model"
import pointManagePropertyModel from "@pages/point-manage/property/model"
import pointManageSpmModel from "@pages/point-manage/spm/model"
import pointManageBasicCodingModel from "@pages/point-manage/basic-coding/model"

export interface RootModel extends Models<RootModel> {
  appModel: typeof appModel
  userModel: typeof userModel
  staticModel: typeof staticModel
  pointModel: typeof pointModel
  pointManageEventModel: typeof pointManageEventModel
  pointManagePropertyModel: typeof pointManagePropertyModel
  pointManageSpmModel: typeof pointManageSpmModel
  pointManageBasicCodingModel: typeof pointManageBasicCodingModel
}

export const models: RootModel = {
  appModel,
  userModel,
  staticModel,
  pointModel,
  pointManageEventModel,
  pointManagePropertyModel,
  pointManageSpmModel,
  pointManageBasicCodingModel,
}
