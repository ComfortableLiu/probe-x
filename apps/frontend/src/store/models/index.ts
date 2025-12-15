import { Models } from "@rematch/core"
import { appModel } from "./app/model"
import { userModel } from "./user/model"
import { staticModel } from "@/store/models/static/model"
import { pointModel } from "@/store/models/point/model"

import pointManageEventModel from "@pages/point-manage/event/model"
import pointManagePropertyModel from "@pages/point-manage/property/model"
import pointManageSpmModel from "@pages/point-manage/spm/model"
import pointManageBasicCodingModel from "@pages/point-manage/basic-coding/model"

import dataAnalysisEventModel from "@pages/data-analysis/event/model"
import dataAnalysisFunnelModel from "@pages/data-analysis/funnel/model"
import dataAnalysisUserPathModel from "@pages/data-analysis/user-path/model"
import dataAnalysisAttributionModel from "@pages/data-analysis/attribution/model"

import analysisModel from "@pages/system-data/analysis/model"
import computingNodeModel from "@pages/system-data/computing-node/model"
import systemDataMetaModel from "@pages/system-data/meta/model"
import systemDataOverviewModel from "@pages/system-data/overview/model"

export interface RootModel extends Models<RootModel> {
  appModel: typeof appModel
  userModel: typeof userModel
  staticModel: typeof staticModel
  pointModel: typeof pointModel

  // 埋点管理
  pointManageEventModel: typeof pointManageEventModel
  pointManagePropertyModel: typeof pointManagePropertyModel
  pointManageSpmModel: typeof pointManageSpmModel
  pointManageBasicCodingModel: typeof pointManageBasicCodingModel

  // 数据分析
  dataAnalysisEventModel: typeof dataAnalysisEventModel
  dataAnalysisFunnelModel: typeof dataAnalysisFunnelModel
  dataAnalysisUserPathModel: typeof dataAnalysisUserPathModel
  dataAnalysisAttributionModel: typeof dataAnalysisAttributionModel

  // 系统数据
  analysisModel: typeof analysisModel
  computingNodeModel: typeof computingNodeModel
  systemDataMetaModel: typeof systemDataMetaModel
  systemDataOverviewModel: typeof systemDataOverviewModel
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
  dataAnalysisEventModel,
  dataAnalysisFunnelModel,
  dataAnalysisUserPathModel,
  dataAnalysisAttributionModel,
  analysisModel,
  computingNodeModel,
  systemDataMetaModel,
  systemDataOverviewModel,
}
