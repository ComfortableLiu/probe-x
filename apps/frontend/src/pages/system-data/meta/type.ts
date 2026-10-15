import {
  ISystemDataCleaningDetail,
  ISystemDataCleaningStats,
  ISystemDataMetaOverview,
  ISystemDataTrend,
} from "@probe-x/shared-types/src"

export interface ISystemDataMetaState {
  overview: ISystemDataMetaOverview;
  dataTrend: ISystemDataTrend;
  cleaningStats: ISystemDataCleaningStats;
  firstCleaningDetail: ISystemDataCleaningDetail;
  finalCleaningDetail: ISystemDataCleaningDetail;
}
