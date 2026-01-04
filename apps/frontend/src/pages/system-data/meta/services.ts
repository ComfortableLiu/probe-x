import request from "@/lib/request"
import {
  ISystemDataCleaningDetail,
  ISystemDataCleaningStats,
  ISystemDataMetaOverview,
  ISystemDataTrend,
} from "@probe-x/shared-types/src"

// 数据趋势查询参数接口
export interface IDataTrendParams {
  days?: number;
  startDate?: string;
  endDate?: string;
}

// 日期查询参数接口
export interface IDateParams {
  date?: string;
}

// 获取元数据概览信息
export function getMetaOverview(params: IDateParams) {
  return request<ISystemDataMetaOverview>({
    url: '/system-data/meta/overview',
    method: 'get',
    params,
  })
}

// 获取数据趋势信息
export function getDataTrend(params: IDataTrendParams) {
  return request<ISystemDataTrend>({
    url: '/system-data/meta/data-trend',
    method: 'get',
    params,
  })
}

// 获取清洗统计数据
export function getCleaningStats(params: IDateParams) {
  return request<ISystemDataCleaningStats>({
    url: '/system-data/meta/cleaning-stats',
    method: 'get',
    params,
  })
}

// 获取初次清洗详情
export function getFirstCleaningDetail(params: IDateParams) {
  return request<ISystemDataCleaningDetail>({
    url: '/system-data/meta/first-cleaning-detail',
    method: 'get',
    params,
  })
}

// 获取最终清洗详情
export function getFinalCleaningDetail(params: IDateParams) {
  return request<ISystemDataCleaningDetail>({
    url: '/system-data/meta/final-cleaning-detail',
    method: 'get',
    params,
  })
}
