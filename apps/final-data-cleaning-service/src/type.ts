// 线上帧类型统一由 shared-types 维护，这里转出以兼容既有引用
export type {
  ComputeTask,
  MasterAck,
  MasterFrame,
  NodeFrame,
  NodeInfo,
  NodeRegister,
  ProgressUpdate,
  ComputeNodeLinkStatus as LinkStatus,
} from '@probe-x/shared-types/src'

/**
 * 双向流抽象
 *
 * 生产实现包装 gRPC duplex call，测试传 fake 即可。
 * 之所以不直接测 @GrpcStreamMethod：该装饰器在 ts-jest 下会改写方法签名
 * （见 __tests__/helpers/testable-service.ts 的说明），无法按普通方法断言。
 */
export interface NodeCall {
  send(frame: import('@probe-x/shared-types/src').NodeFrame): void
  onFrame(handler: (frame: import('@probe-x/shared-types/src').MasterFrame) => void): void
  onClose(handler: () => void): void
  onError(handler: (error: Error) => void): void
  close(): void
}
