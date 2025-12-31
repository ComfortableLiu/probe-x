export interface ISystemDataMetaOverview {
  originalDataTotal: string;
  finalCleanedData: string;
  firstCleaningSuccessRate: number;
  finalCleaningSuccessRate: number;
}

export interface ISystemDataTrend {
  xAxis: string[];
  series: Array<{
    name: string;
    data: number[];
  }>;
}

export interface ISystemDataCleaningStats {
  firstCleaning: {
    successRate: number;
    successCount: string;
    failCount: string;
  };
  finalCleaning: {
    successRate: number;
    successCount: string;
    failCount: string;
  };
}

export interface ISystemDataCleaningDetail {
  successRate: number;
  successCount: string;
  failCount: string;
  detailList: any[]; // 可以根据需要扩展详细信息
}

// 系统数据概览相关类型定义
export interface ISystemDataOverviewResponse {
  computingNodeStatus: IComputingNodeStatus;
  systemPerformanceMetrics: ISystemPerformanceMetrics;
  eventCollectionMetrics: IEventCollectionMetrics;
  realTimeProcessingMetrics: IRealTimeProcessingMetrics;
  metaOverview: ISystemDataMetaOverview;
}

export interface IComputingNodeStatus {
  totalNodes: number;
  onlineNodes: number;
  offlineNodes: number;
  onlineRate: number; // 百分比
  cpuUsage: number; // 百分比
  memoryUsage: number; // 百分比
  avgLoad: number;
  networkTraffic: number; // Gbps
}

export interface ISystemPerformanceMetrics {
  currentQps: number;
  peakQps: number;
  avgQps: number;
  avgResponseTime: number; // ms
  p95ResponseTime: number; // ms
  p99ResponseTime: number; // ms
  systemAvailability: number; // 百分比
  currentMonthAvailability: number; // 百分比
  requestErrorRate: number; // 百分比
  systemErrorRate: number; // 百分比
  exceptionCaptureRate: number; // 百分比
}

export interface IEventCollectionMetrics {
  todayCollection: number;
  yesterdayCollection: number;
  weekCollection: number;
  monthCollection: number;
  totalAmount: number; // 累计总量
}

export interface IMetaEventOverview {
  originalDataTotal: string;
  finalCleanedData: string;
  firstCleaningSuccessRate: number;
  finalCleaningSuccessRate: number;
  todayNew: number;
  weekNew: number;
  monthNew: number;
  totalAmount: number;
}

export interface IRealTimeProcessingMetrics {
  currentProcessing: number;
  peakProcessing: number;
  cumulativeProcessing: number;
}