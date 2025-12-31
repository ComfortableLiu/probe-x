export interface ISystemDataAnalysisState {
  statistics?: {
    queryCount: number;
    userCount: number;
    avgDuration: string;
    failureRate: string;
    queuedTasks: number;
    processingTasks: number;
    terminatedTasks: number;
    exportCount: number;
    exportUserCount: number;
  };
  hourlyChartData?: {
    hours: string[];
    queryCounts: number[];
    userCounts: number[];
  };
  dailyChartData?: {
    dates: string[];
    queryCounts: number[];
    userCounts: number[];
  };
  taskList?: Array<{
    id: number;
    taskName: string;
    initiator: string;
    status: string;
    startTime: string;
    endTime: string;
    duration: string;
  }>;
  total?: number;
  page?: number;
  pageSize?: number;
}