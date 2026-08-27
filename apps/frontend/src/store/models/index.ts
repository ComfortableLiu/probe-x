import { Models } from "@rematch/core"
import { appModel } from "./app/model"
import { userModel } from "./user/model"
import { staticModel } from "@/store/models/static/model"
import { pointModel } from "@/store/models/point/model"

import pointManageEventModel from "@pages/point-manage/event/model"
import pointManagePropertyModel from "@pages/point-manage/property/model"
import pointManageSpmModel from "@pages/point-manage/spm/model"
import pointManageScmModel from "@pages/point-manage/scm/model"
import pointManageBasicCodingModel from "@pages/point-manage/basic-coding/model"

import dataAnalysisEventModel from "@pages/data-analysis/event/model"
import dataAnalysisFunnelModel from "@pages/data-analysis/funnel/model"
import dataAnalysisUserPathModel from "@pages/data-analysis/user-path/model"
import dataAnalysisAttributionModel from "@pages/data-analysis/attribution/model"

import systemDataAnalysisModel from "@pages/system-data/analysis/model"
import computingNodeModel from "@pages/system-data/computing-node/model"
import systemDataMetaModel from "@pages/system-data/meta/model"
import systemDataOverviewModel from "@pages/system-data/overview/model"
import systemDataAlertModel from "@pages/system-data/alert/model"

import systemConfigUserManageModel from "@pages/system-config/user/model"
import systemConfigRoleManageModel from "@pages/system-config/role/model"
import systemConfigSystemManageModel from "@pages/system-config/system/model"
import systemConfigDataSourceModel from "@pages/system-config/datasource/model"
import systemConfigComputeNodeModel from "@pages/system-config/computing-node/model"
import systemConfigNotificationModel from "@pages/system-config/notification/model"
import systemConfigProjectModel from "@pages/system-config/project/model"
import systemConfigAuditLogModel from "@pages/system-config/audit-log/model"

import homepageModel from "@pages/homepage/model"

export interface RootModel extends Models<RootModel> {
  appModel: typeof appModel
  userModel: typeof userModel
  staticModel: typeof staticModel
  pointModel: typeof pointModel

  // 首页看板
  homepageModel: typeof homepageModel

  // 埋点管理
  pointManageEventModel: typeof pointManageEventModel
  pointManagePropertyModel: typeof pointManagePropertyModel
  pointManageSpmModel: typeof pointManageSpmModel
  pointManageScmModel: typeof pointManageScmModel
  pointManageBasicCodingModel: typeof pointManageBasicCodingModel

  // 数据分析
  dataAnalysisEventModel: typeof dataAnalysisEventModel
  dataAnalysisFunnelModel: typeof dataAnalysisFunnelModel
  dataAnalysisUserPathModel: typeof dataAnalysisUserPathModel
  dataAnalysisAttributionModel: typeof dataAnalysisAttributionModel

  // 系统数据
  computingNodeModel: typeof computingNodeModel
  systemDataMetaModel: typeof systemDataMetaModel
  systemDataOverviewModel: typeof systemDataOverviewModel
  systemDataAnalysisModel: typeof systemDataAnalysisModel
  systemDataAlertModel: typeof systemDataAlertModel

  // 系统配置
  systemConfigUserManageModel: typeof systemConfigUserManageModel
  systemConfigRoleManageModel: typeof systemConfigRoleManageModel
  systemConfigSystemManageModel: typeof systemConfigSystemManageModel
  systemConfigDataSourceModel: typeof systemConfigDataSourceModel
  systemConfigComputeNodeModel: typeof systemConfigComputeNodeModel
  systemConfigNotificationModel: typeof systemConfigNotificationModel
  systemConfigProjectModel: typeof systemConfigProjectModel
  systemConfigAuditLogModel: typeof systemConfigAuditLogModel
}

export const models: RootModel = {
  appModel,
  userModel,
  staticModel,
  pointModel,
  homepageModel,
  pointManageEventModel,
  pointManagePropertyModel,
  pointManageSpmModel,
  pointManageScmModel,
  pointManageBasicCodingModel,
  dataAnalysisEventModel,
  dataAnalysisFunnelModel,
  dataAnalysisUserPathModel,
  dataAnalysisAttributionModel,
  computingNodeModel,
  systemDataMetaModel,
  systemDataOverviewModel,
  systemDataAnalysisModel,
  systemDataAlertModel,
  systemConfigUserManageModel,
  systemConfigRoleManageModel,
  systemConfigSystemManageModel,
  systemConfigDataSourceModel,
  systemConfigComputeNodeModel,
  systemConfigNotificationModel,
  systemConfigProjectModel,
  systemConfigAuditLogModel,
}
