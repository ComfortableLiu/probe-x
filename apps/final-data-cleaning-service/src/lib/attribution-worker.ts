import { parentPort } from 'node:worker_threads'
import { computeAttribution } from './attribution-engine'
import type { AttributionWorkerRequest, AttributionWorkerResponse } from './attribution-worker.types'

const port = parentPort
const PROGRESS_BATCH_SIZE = 500

if (!port) {
  throw new Error('Attribution worker must run in a worker thread')
}

port.on('message', (message: AttributionWorkerRequest) => {
  if (message.type !== 'compute') return

  const send = (response: AttributionWorkerResponse) => port.postMessage(response)
  try {
    const { attributions } = computeAttribution(message.events, (processed, total) => {
      // 批量汇报，避免每条事件触发跨线程消息和 gRPC 进度更新。
      if (processed % PROGRESS_BATCH_SIZE === 0 || processed === total) {
        send({ type: 'progress', taskId: message.taskId, processed, total })
      }
    })
    send({ type: 'result', taskId: message.taskId, attributions })
  } catch (error) {
    const failure = error instanceof Error ? error : new Error(String(error))
    send({
      type: 'error',
      taskId: message.taskId,
      error: { message: failure.message, stack: failure.stack },
    })
  }
})
