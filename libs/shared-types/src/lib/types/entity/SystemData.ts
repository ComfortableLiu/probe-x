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
