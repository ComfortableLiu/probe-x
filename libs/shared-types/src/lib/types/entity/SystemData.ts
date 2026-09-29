export interface ISystemDataMetaOverview {
  originalDataTotal: string;
  finalCleanedData: string;
  firstCleaningSuccessRate: number | null;
  finalCleaningSuccessRate: number | null;
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
  serviceResources: IServiceResourceGroup[];
  computingNodeStatus: IComputingNodeStatus;
  systemPerformanceMetrics: ISystemPerformanceMetrics;
  eventCollectionMetrics: IEventCollectionMetrics;
  realTimeProcessingMetrics: IRealTimeProcessingMetrics;
  metaOverview: ISystemDataMetaOverview;
  analysisQueryMetrics: IAnalysisQueryMetrics;
  updatedAt: string;
  warnings: string[];
}

export interface IComputingNodeStatus {
  totalNodes: number | null;
  onlineNodes: number | null;
  offlineNodes: number | null;
  onlineRate: number | null; // 百分比
  cpuUsage: number | null; // 百分比
  memoryUsage: number | null; // 百分比
  avgLoad: number | null;
  networkTraffic: number | null; // Gbps
}

export interface ISystemPerformanceMetrics {
  currentQps: number | null;
  peakQps: number | null;
  avgQps: number | null;
  avgResponseTime: number | null; // ms
  p95ResponseTime: number | null; // ms
  p99ResponseTime: number | null; // ms
  systemAvailability: number | null; // 上一完整分钟请求成功率，不是在线时长占比
  currentMonthAvailability: number | null; // 本月已采样请求成功率
  requestErrorRate: number | null; // 百分比
  systemErrorRate: number | null; // 百分比
  businessErrorRate: number | null; // 百分比
}

export interface IEventCollectionMetrics {
  todayCollection: number | null;
  yesterdayCollection: number | null;
  weekCollection: number | null;
  monthCollection: number | null;
  totalAmount: number | null; // 当前表内存量，受保留期影响
}

export interface IMetaEventOverview {
  originalDataTotal: string;
  finalCleanedData: string;
  firstCleaningSuccessRate: number | null;
  finalCleaningSuccessRate: number | null;
  todayNew: number;
  weekNew: number;
  monthNew: number;
  totalAmount: number;
}

export interface IRealTimeProcessingMetrics {
  currentProcessing: number | null; // 上一个完整自然分钟成功写入的事件数
  peakProcessing: number | null; // 今日完整分钟峰值
  cumulativeProcessing: number | null; // 当前 ClickHouse 清洗后存量
}
export interface IAnalysisQueryMetrics {
  todayQueries: number | null;
  yesterdayQueries: number | null;
  weekQueries: number | null;
  monthQueries: number | null;
}

/** A service instance's latest sample. CPU 100% means one fully occupied logical core. */
export interface IServiceResourceSnapshot {
  instanceId: string;
  serviceKey: string;
  hostname: string;
  pid: number;
  scope: 'process' | 'process-tree';
  sampledAt: number;
  stoppedAt: number | null;
  cpuUsage: number | null;
  cpuCores: number;
  memoryRssBytes: number;
  heapUsedBytes: number | null;
  uptimeSeconds: number;
  processCount: number;
  hostCpuUsage: number | null;
  hostMemoryTotalBytes: number;
  hostMemoryUsedBytes: number;
  hostLoad1: number | null;
}

export interface IServiceResourceGroup {
  serviceKey: string;
  serviceName: string;
  instances: Array<IServiceResourceSnapshot & { status: 'online' | 'offline' }>;
}
