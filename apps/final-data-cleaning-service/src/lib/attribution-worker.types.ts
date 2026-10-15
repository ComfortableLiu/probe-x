import type { IAttribution } from '@probe-x/shared-types/src'
import type { AttributionEvent } from './attribution-engine'

export type AttributionWorkerEvent = AttributionEvent

export interface AttributionWorkerRequest {
  type: 'compute'
  taskId: number
  /** 同一个 session 的完整事件列表，不在池内再次拆分。 */
  events: AttributionWorkerEvent[]
}

export type AttributionWorkerResponse = {
  type: 'progress'
  taskId: number
  processed: number
  total: number
} | {
  type: 'result'
  taskId: number
  attributions: IAttribution[]
} | {
  type: 'error'
  taskId: number
  error: { message: string; stack?: string }
}

/** 最小 Worker 接口，也允许测试注入不启动线程的替身。 */
export interface AttributionWorkerLike {
  postMessage(message: AttributionWorkerRequest): void
  on(event: 'message', listener: (message: AttributionWorkerResponse) => void): unknown
  on(event: 'error', listener: (error: Error) => void): unknown
  on(event: 'exit', listener: (code: number) => void): unknown
  terminate(): Promise<number> | number
  ref?(): unknown
  unref?(): unknown
}
