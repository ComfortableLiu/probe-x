import type {
  IComputeNodeTopology,
} from '@probe-x/shared-types/src'

export type {
  ComputeNodeLinkStatus,
  IComputeNodeLinkInfo,
  IComputeNodeTopology,
} from '@probe-x/shared-types/src'

/**
 * 页面状态灯
 *
 * 比线上链接态（connected/connecting/disconnected）多分出「忙碌 / 报错」两档，
 * 只用于拓扑图配色，不参与线上协议。
 */
export type ComputingNodeLight = 'healthy_idle' | 'healthy_busy' | 'error' | 'offline'

export interface ISystemDataComputingNodeState {
  /** 拓扑数据，未拉取过时为 null */
  topology: IComputeNodeTopology | null
  /** 首屏拉取中 */
  loading: boolean
  /** 最近一次拉到数据的时间戳，用于「最近心跳」文案 */
  fetchedAt: number | null
}
