import { ISystemDataOverviewResponse } from '@probe-x/shared-types/src'

export interface ISystemDataOverviewWithMetaState extends ISystemDataOverviewResponse {
  loading?: boolean
  error?: string | null
}

export type ISystemDataOverviewState = ISystemDataOverviewWithMetaState
