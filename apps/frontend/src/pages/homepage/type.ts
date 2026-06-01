import {
  IHomepageOverview,
  IHomepageTrend,
  IRealtimeEventsResponse,
} from '@probe-x/shared-types/src'

export interface IHomepageState {
  loading: boolean
  overview: IHomepageOverview
  trend: IHomepageTrend
  realtimeEvents: IRealtimeEventsResponse
}
