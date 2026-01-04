import {
  ISystemDataOverviewResponse,
  IComputingNodeStatus,
  ISystemPerformanceMetrics,
  IEventCollectionMetrics,
  IRealTimeProcessingMetrics,
  ISystemDataMetaOverview,
} from '@probe-x/shared-types/src'

export interface ISystemDataOverviewState extends ISystemDataOverviewResponse {
  // 可以根据实际需要添加状态类型定义
  loading?: boolean;
}

export interface ISystemDataOverviewWithMetaState extends ISystemDataOverviewResponse {
  metaOverview: ISystemDataMetaOverview;
  loading?: boolean;
}