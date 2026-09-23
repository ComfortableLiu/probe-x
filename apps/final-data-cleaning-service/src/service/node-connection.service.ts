import { Injectable, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Subject } from 'rxjs'
import grpc from '@grpc/grpc-js'
import protoLoader from '@grpc/proto-loader'
import { resolveProtoPath } from '@probe-x/shared-utils/src/lib/backend-common'
import { ComputeNodeService } from './node.service'
import type {
  ComputeTask,
  LinkStatus,
  MasterFrame,
  NodeCall,
  NodeFrame,
  ProgressUpdate,
} from '../type'

type DuplexStream = grpc.ClientDuplexStream<NodeFrame, MasterFrame>

const PROTO_PACKAGE = 'final_data_cleaning_control_bi_stream'
const DEFAULT_HEARTBEAT_INTERVAL_MS = 5000
const RECONNECT_DELAY_MIN_MS = 1000
const RECONNECT_DELAY_MAX_MS = 30000

// proto 只加载一次，断线重连时复用
const loadClientCtor = (() => {
  let cached: any
  return () => {
    if (!cached) {
      const definition = protoLoader.loadSync(resolveProtoPath(PROTO_PACKAGE), {
        // 保持 snake_case 字段名，与 proto 及现有类型定义（task_id 等）一致
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
      })
      const pkg = grpc.loadPackageDefinition(definition) as any
      cached = pkg[PROTO_PACKAGE].NodeControlService
    }
    return cached
  }
})()

/** 把 gRPC 双向流包装成 NodeCall，方便单测注入假实现 */
class GrpcNodeCall implements NodeCall {
  private settled = false

  constructor(private readonly stream: DuplexStream, private readonly client: grpc.Client) {}

  send(frame: NodeFrame): void {
    this.stream.write(frame)
  }

  onFrame(handler: (frame: MasterFrame) => void): void {
    this.stream.on('data', (frame: MasterFrame) => handler(frame))
  }

  onClose(handler: () => void): void {
    // end / close 都会触发，去重保证只回调一次
    const fire = () => {
      if (this.settled) return
      this.settled = true
      handler()
    }
    this.stream.on('end', fire)
    this.stream.on('close', fire)
  }

  onError(handler: (error: Error) => void): void {
    this.stream.on('error', (error: Error) => handler(error))
  }

  close(): void {
    try {
      this.stream.cancel()
    } catch {
      // 流已结束时取消会抛错，忽略
    }
    this.client.close()
  }
}

/**
 * 计算节点 -> 总服务 的接入客户端
 *
 * 节点作为 gRPC 客户端拨出连接总服务：上行注册/心跳/任务进度，下行接收计算任务。
 * 拨出模型下节点不需要任何入网端口，配置 MASTER_HOST/MASTER_PORT 即可部署。
 */
@Injectable()
export class NodeConnectionService implements OnApplicationBootstrap, OnModuleDestroy {
  /** 与总服务的链接状态 */
  linkStatus: LinkStatus = 'connecting'
  /** 最近一次链接错误，空串表示无异常 */
  lastError = ''
  /** 本次链接建立时间戳，未连接时为 null */
  connectedAt: number | null = null

  private masterAddr = ''
  private call: NodeCall | null = null
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectDelay = 0
  private stopped = false

  constructor(
    private readonly nodeService: ComputeNodeService,
    private readonly configService: ConfigService,
  ) {}

  onApplicationBootstrap(): void {
    this.masterAddr = this.resolveMasterAddr()
    console.log(
      `[节点 ${this.nodeService.nodeId}] 开始接入总服务 ${this.masterAddr}（节点名：${this.nodeService.nodeName}）`,
    )
    this.connect()
  }

  onModuleDestroy(): void {
    this.stopped = true
    this.clearTimers()
    this.closeCall()
  }

  /** 链接状态快照，供 /health 输出 */
  getSnapshot() {
    return {
      nodeId: this.nodeService.nodeId,
      nodeName: this.nodeService.nodeName,
      masterAddr: this.masterAddr,
      link: this.linkStatus,
      connectedAt: this.connectedAt,
      lastError: this.lastError,
      currentTaskId: this.nodeService.currentTaskId,
    }
  }

  /** 发送注册帧，同时兼作心跳（刷新 CPU/内存/忙碌状态） */
  sendRegister(): void {
    this.call?.send({
      register: {
        node_id: this.nodeService.nodeId,
        node_name: this.nodeService.nodeName,
        node_address: this.configService.get<string>('node.advertiseAddress') || '',
        version: process.env.npm_package_version || '0.0.0',
        info: this.nodeService.getLocalNodeInfo(),
      },
    })
  }

  /** 建立一次双向流。测试可覆写以注入假实现 */
  protected createCall(): NodeCall {
    const ClientCtor = loadClientCtor()
    const client: grpc.Client = new ClientCtor(this.masterAddr, grpc.credentials.createInsecure())
    const stream: DuplexStream = (client as any).Connect()
    return new GrpcNodeCall(stream, client)
  }

  private connect(): void {
    if (this.stopped) return

    this.linkStatus = 'connecting'

    let call: NodeCall
    try {
      call = this.createCall()
    } catch (error) {
      this.fail(error)
      return
    }

    this.call = call

    // 流关闭与报错都会走到这里，去重保证只重连一次
    let settled = false
    const settle = (error: Error) => {
      if (settled) return
      settled = true
      this.clearTimers()
      this.closeCall()
      this.linkStatus = 'disconnected'
      this.connectedAt = null
      this.lastError = error.message
      if (this.stopped) return
      console.warn(`[节点 ${this.nodeService.nodeId}] 与总服务的链接断开：${error.message}`)
      this.scheduleReconnect()
    }

    call.onError((error) => settle(error))
    call.onClose(() => settle(new Error('与总服务的链接已断开')))
    call.onFrame((frame) => this.handleFrame(frame))

    this.sendRegister()
    this.startHeartbeat()

    // gRPC 的 duplex 流对象一建就返回，此时只是「发起了一条 RPC」，
    // 是否真连上要等总服务回帧确认，所以这里先停在 connecting
    this.linkStatus = 'connecting'
  }

  private handleFrame(frame: MasterFrame): void {
    // 总服务回了帧，链接才算真正建立
    if (this.linkStatus !== 'connected') {
      this.linkStatus = 'connected'
      this.connectedAt = Date.now()
      this.lastError = ''
      console.log(`[节点 ${this.nodeService.nodeId}] 已接入总服务 ${this.masterAddr}`)
    }
    // 有回帧即证明总服务在线，重连退避从头计。
    // 若在这里不动 reconnectDelay，每次 connect() 成功后退避都会归零，
    // 总服务不可达时会退化成固定的 1s 重试，达不到 1s→2s→…→30s
    this.reconnectDelay = 0

    if (frame.ack) {
      if (!frame.ack.accepted) {
        this.lastError = frame.ack.message || '总服务拒绝接入'
        console.error(`[节点 ${this.nodeService.nodeId}] 总服务拒绝接入：${this.lastError}`)
      }
      return
    }

    if (frame.task) {
      this.handleTask(frame.task)
    }
  }

  private handleTask(task: ComputeTask): void {
    console.log(`[节点 ${this.nodeService.nodeId}] 收到总服务任务 ${task.task_id}`)

    // 每个任务一条独立进度流，避免共享 Subject 在任务结束后被 complete 影响后续任务
    const progressSubject = new Subject<ProgressUpdate>()
    const subscription = progressSubject.subscribe((progress) => {
      this.call?.send({ progress })
    })

    this.nodeService.executeTask(task, progressSubject).finally(() => {
      subscription.unsubscribe()
    })
  }

  private startHeartbeat(): void {
    this.clearHeartbeat()
    const interval =
      Number(this.configService.get('node.heartbeatIntervalMs')) || DEFAULT_HEARTBEAT_INTERVAL_MS
    this.heartbeatTimer = setInterval(() => this.sendRegister(), interval)
  }

  private scheduleReconnect(): void {
    if (this.stopped || this.reconnectTimer) return

    // 指数退避：1s 起，上限 30s，无限重试
    this.reconnectDelay = this.reconnectDelay
      ? Math.min(this.reconnectDelay * 2, RECONNECT_DELAY_MAX_MS)
      : RECONNECT_DELAY_MIN_MS

    console.warn(
      `[节点 ${this.nodeService.nodeId}] ${this.reconnectDelay}ms 后重连总服务 ${this.masterAddr}`,
    )
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
    }, this.reconnectDelay)
  }

  private fail(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error)
    this.lastError = message
    this.linkStatus = 'disconnected'
    this.connectedAt = null
    console.error(`[节点 ${this.nodeService.nodeId}] 接入总服务失败：${message}`)
    this.scheduleReconnect()
  }

  private resolveMasterAddr(): string {
    const host = this.configService.get<string>('master.host') || 'localhost'
    const port = this.configService.get<string>('master.port') || '8105'
    // 允许把 MASTER_HOST 写成 http://host/ 形式，gRPC 只要 host:port
    const normalizedHost = host.replace(/^https?:\/\//, '').replace(/\/+$/, '')
    return `${normalizedHost}:${port}`
  }

  private clearHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  private clearTimers(): void {
    this.clearHeartbeat()
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  private closeCall(): void {
    this.call?.close()
    this.call = null
  }
}
