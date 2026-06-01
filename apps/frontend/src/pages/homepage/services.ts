import request from '@/lib/request'
import {
  IHomepageOverview,
  IHomepageTrend,
  IRealtimeEventsResponse,
} from '@probe-x/shared-types/src'

/**
 * 获取首页聚合统计
 */
export function getHomepageOverview() {
  return request<IHomepageOverview>({
    url: '/homepage/overview',
    method: 'get',
  })
}

/**
 * 获取趋势数据
 */
export function getHomepageTrend(days: number = 7) {
  return request<IHomepageTrend>({
    url: '/homepage/trend',
    method: 'get',
    data: { days },
  })
}

/**
 * 获取实时事件流
 */
export function getHomepageRealtimeEvents(limit: number = 20) {
  return request<IRealtimeEventsResponse>({
    url: '/homepage/realtime-events',
    method: 'get',
    data: { limit },
  })
}
