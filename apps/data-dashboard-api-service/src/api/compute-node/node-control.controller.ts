import { Controller } from '@nestjs/common'
import { GrpcStreamMethod } from '@nestjs/microservices'
import { Observable, Subject } from 'rxjs'
import type { MasterFrame, NodeFrame } from '@probe-x/shared-types/src'
import type { NodeSession } from './node-registry.service'
import { NodeRegistryService } from './node-registry.service'

const PROTO_SERVICE = 'NodeControlService'
const PROTO_METHOD = 'Connect'

/**
 * 计算节点接入的 gRPC 双向流入口
 *
 * 这里必须是 controller：NestJS 的 MicroservicesModule.setupListeners 只扫描
 * module.controllers，@GrpcStreamMethod 写在 provider 上不会被注册成 RPC handler。
 * 本控制器只做传输适配，业务状态全在 NodeRegistryService。
 *
 * 入参一律声明成 any：全局 ValidationPipe 会按 emitDecoratorMetadata 产出的
 * paramtypes 跑校验，写成 Observable 会被当成待校验实体而报错。
 */
@Controller()
export class NodeControlController {
  constructor(private readonly registry: NodeRegistryService) {}

  @GrpcStreamMethod(PROTO_SERVICE, PROTO_METHOD)
  connect(inbound: any, _metadata?: any, call?: any): Observable<MasterFrame> {
    const request$ = inbound as Observable<NodeFrame>
    const stream = call as
      | { on(event: string, listener: (...args: any[]) => void): unknown }
      | undefined

    const outbound = new Subject<MasterFrame>()
    const session: NodeSession = {
      send: (frame) => outbound.next(frame),
      close: () => outbound.complete(),
    }
    const handle = this.registry.openSession(session)

    // end / close / cancel / inbound 终止都会走到这里，去重保证只收尾一次
    let settled = false
    const teardown = (reason: string) => {
      if (settled) return
      settled = true
      handle.onClose(reason)
      outbound.complete()
    }

    request$.subscribe({
      next: (frame) => handle.onFrame(frame),
      error: (error: Error) => teardown(error?.message || '链接异常'),
      complete: () => teardown('对端关闭了链接'),
    })

    // NestJS 对 cancelled 错误只调 call.end()，不会结束 inbound，
    // 所以要直接监听 gRPC call 的生命周期做兜底
    stream?.on('cancelled', () => teardown('对端取消了链接'))
    stream?.on('close', () => teardown('链接已关闭'))

    return outbound.asObservable()
  }
}
