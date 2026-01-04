import request from '@/lib/request'
import { ISystemDataOverviewResponse } from '@probe-x/shared-types/src'

// 获取系统数据概览
export function getSystemDataOverview() {
  return request<ISystemDataOverviewResponse>({
    url: '/system-data/overview',
    method: 'get',
  })
}
