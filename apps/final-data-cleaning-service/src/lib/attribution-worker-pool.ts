import { availableParallelism } from 'node:os'
import { join } from 'node:path'
import { Worker } from 'node:worker_threads'
import type { IAttribution, IPreEventLog } from '@probe-x/shared-types/src'
import type { AttributionEngineResult } from './attribution-engine'
import type {
  AttributionWorkerEvent,
  AttributionWorkerLike,
  AttributionWorkerResponse,
} from './attribution-worker.types'

export interface AttributionWorkerPoolOptions {
  concurrency?: number
  workerPath?: string
  workerFactory?: (workerPath: string) => AttributionWorkerLike
}

interface Computation {
  taskId: number
  eventList: IPreEventLog[]
  events: AttributionWorkerEvent[]
  processed: number
  settled: boolean
  error?: Error
  onProgress?: (processed: number, total: number) => void
  resolve: (result: AttributionEngineResult) => void
  reject: (error: Error) => void
}

interface WorkerSlot {
  worker: AttributionWorkerLike
  current?: Computation
  disposed: boolean
}

/** 一个完整 session 占用一个线程，同时处理的 session 数不超过 CPU 可用并行度。 */
export class AttributionWorkerPool {
  readonly concurrency: number

  private readonly workerPath: string
  private readonly workerFactory: (workerPath: string) => AttributionWorkerLike
  private readonly workers = new Set<WorkerSlot>()
  private readonly terminations = new Set<Promise<void>>()
  private queue: Computation[] = []
  private nextTaskId = 1
  private dispatching = false
  private closed = false
  private shutdown?: Promise<void>

  constructor(options: AttributionWorkerPoolOptions = {}) {
    this.concurrency = options.concurrency ?? availableParallelism()
    if (!Number.isSafeInteger(this.concurrency) || this.concurrency < 1) {
      throw new Error('Attribution worker concurrency must be a positive integer')
    }
    this.workerPath = options.workerPath ?? join(__dirname, 'attribution-worker.js')
    this.workerFactory = options.workerFactory ?? (workerPath => new Worker(workerPath))
  }

  async compute(
    eventList: IPreEventLog[],
    onProgress?: (processed: number, total: number) => void,
  ): Promise<AttributionEngineResult> {
    if (this.closed) throw new Error('Attribution worker pool is closed')
    if (eventList.length === 0) return { finalEvents: eventList, attributions: [] }

    // 仅投影归因字段，完整事件列表保留在主线程，不跨线程复制宽表。
    const events = eventList.map(event => ({
      $is_attribution_event: event.$is_attribution_event,
      $target_page_id: event.$target_page_id,
      $ex_attribution_params: event.$ex_attribution_params,
      $service_time: event.$service_time,
      $event_id: event.$event_id,
      $session_id: event.$session_id,
    }))
    return new Promise((resolve, reject) => {
      const computation: Computation = {
        taskId: this.nextTaskId++,
        eventList,
        events,
        processed: 0,
        settled: false,
        onProgress,
        resolve,
        reject,
      }
      this.queue.push(computation)
      this.dispatch()
    })
  }

  onModuleDestroy(): Promise<void> {
    if (this.shutdown) return this.shutdown
    this.closed = true
    const failure = new Error('Attribution worker pool is closed')
    const queued = this.queue
    this.queue = []
    for (const computation of queued) this.finishComputation(computation, undefined, failure)

    for (const slot of this.workers) {
      const current = slot.current
      slot.current = undefined
      if (current) this.finishComputation(current, undefined, failure)
      void this.removeWorker(slot)
    }
    this.shutdown = Promise.all(this.terminations).then(() => undefined)
    return this.shutdown
  }

  private dispatch(): void {
    if (this.dispatching || this.closed) return
    this.dispatching = true
    try {
      while (this.queue.length > 0 && !this.closed) {
        let slot = Array.from(this.workers).find(worker => !worker.current)
        if (!slot && this.workers.size >= this.concurrency) break

        const computation = this.queue.shift()!
        try {
          slot ??= this.createWorker()
          slot.current = computation
          slot.worker.ref?.()
          slot.worker.postMessage({ type: 'compute', taskId: computation.taskId, events: computation.events })
        } catch (error) {
          if (slot) {
            slot.current = undefined
            void this.removeWorker(slot)
          }
          this.finishComputation(computation, undefined, this.asError(error))
        }
      }
    } finally {
      this.dispatching = false
    }
  }

  private createWorker(): WorkerSlot {
    const worker = this.workerFactory(this.workerPath)
    const slot: WorkerSlot = { worker, disposed: false }
    this.workers.add(slot)
    try {
      worker.on('message', message => this.onMessage(slot, message))
      worker.on('error', error => this.onWorkerFailure(slot, error))
      worker.on('exit', code => this.onWorkerFailure(slot, new Error(`Attribution worker exited with code ${code}`)))
      worker.unref?.()
    } catch (error) {
      void this.removeWorker(slot)
      throw error
    }
    return slot
  }

  private onMessage(slot: WorkerSlot, message: AttributionWorkerResponse): void {
    const computation = slot.current
    if (slot.disposed || !computation || message.taskId !== computation.taskId) return
    if (message.type === 'progress') {
      this.reportProgress(computation, message.processed)
      return
    }
    if (message.type === 'error') {
      const failure = new Error(message.error.message)
      if (message.error.stack) failure.stack = message.error.stack
      this.onWorkerFailure(slot, failure)
      return
    }
    if (message.type !== 'result') return

    slot.current = undefined
    slot.worker.unref?.()
    this.finishComputation(computation, message.attributions)
    this.dispatch()
  }

  private reportProgress(computation: Computation, processed: number): void {
    if (computation.error || computation.settled || this.closed || !Number.isFinite(processed)) return
    const next = Math.min(computation.events.length, Math.max(0, Math.floor(processed)))
    if (next <= computation.processed) return
    computation.processed = next
    try {
      computation.onProgress?.(computation.processed, computation.eventList.length)
    } catch (error) {
      // 回调失败等待该 session 的线程计算结束，其他 session 继续独立执行。
      computation.error = this.asError(error)
    }
  }

  private onWorkerFailure(slot: WorkerSlot, error: Error): void {
    if (slot.disposed) return
    const computation = slot.current
    slot.current = undefined
    void this.removeWorker(slot)
    if (computation) this.finishComputation(computation, undefined, error)
    this.dispatch()
  }

  private finishComputation(computation: Computation, attributions?: IAttribution[], error?: Error): void {
    if (computation.settled) return
    if (error) computation.error ??= error
    else this.reportProgress(computation, computation.events.length)
    computation.settled = true
    if (computation.error) computation.reject(computation.error)
    else computation.resolve({ finalEvents: computation.eventList, attributions: attributions ?? [] })
  }

  private removeWorker(slot: WorkerSlot): Promise<void> {
    if (slot.disposed) return Promise.resolve()
    slot.disposed = true
    this.workers.delete(slot)
    let termination: Promise<void>
    try {
      termination = Promise.resolve(slot.worker.terminate()).then(() => undefined, () => undefined)
    } catch {
      termination = Promise.resolve()
    }
    this.terminations.add(termination)
    void termination.then(() => this.terminations.delete(termination))
    return termination
  }

  private asError(error: unknown): Error {
    return error instanceof Error ? error : new Error(String(error))
  }
}
