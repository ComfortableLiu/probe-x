// 系统数据元信息状态接口定义
export interface ISystemDataMetaState {
  // 元数据概览信息
  overview: {
    originalDataTotal: string; // 原始数据总量
    finalCleanedData: string; // 最终清洗数据量
    firstCleaningSuccessRate: number; // 初次清洗成功率
    finalCleaningSuccessRate: number; // 最终清洗成功率
  };
  // 数据趋势信息
  dataTrend: {
    xAxis: string[]; // X轴数据（通常是时间）
    series: Array<{ // 数据系列
      name: string; // 系列名称
      data: number[]; // 系列数据
    }>;
  };
  // 清洗统计信息
  cleaningStats: {
    firstCleaning: { // 初次清洗统计
      successRate: number; // 成功率
      successCount: string; // 成功数量
      failCount: string; // 失败数量
    };
    finalCleaning: { // 最终清洗统计
      successRate: number; // 成功率
      successCount: string; // 成功数量
      failCount: string; // 失败数量
    };
  };
  // 初次清洗详情
  firstCleaningDetail: {
    successRate: number; // 成功率
    successCount: string; // 成功数量
    failCount: string; // 失败数量
    detailList: any[]; // 详情列表
  };
  // 最终清洗详情
  finalCleaningDetail: {
    successRate: number; // 成功率
    successCount: string; // 成功数量
    failCount: string; // 失败数量
    detailList: any[]; // 详情列表
  };
}