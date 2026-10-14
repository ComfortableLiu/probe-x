import { Injectable, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  ComputeTask,
  IComputeNodeCleaningSpeed,
  IComputeNodeLinkInfo,
  IComputeNodeTopology,
  MasterFrame,
  NodeFrame,
  NodeInfo,
  NodeLogEntry,
  NodeRegister,
  NodeStatus,
  ProgressUpdate,
} from '@probe-x/shared-types/src'
import { RedisService } from '@probe-x/shared-utils/src/lib/backend-common'
import {
  readNodeCleaningSpeeds,
  recordCleaningSessionCompletion,
  recordNodeCleaningSpeed,
} from '@probe-x/shared-utils/src/lib/backend-common/runtime-metrics'
import { appendNodeLogs, readNodeLogs } from '@probe-x/shared-utils/src/lib/backend-common/node-logs'
import { ComputeNodeService } from './compute-node.service'

/** 判定离线的心跳超时，默认 15s（3 倍于节点默认 5s 心跳间隔） */
const DEFAULT_HEARTBEAT_TIMEOUT_MS = 15000
/** 把派生链接态回写 compute_node.status 的巡检间隔 */
const STATUS_RECONCILE_INTERVAL_MS = 10000
/** 实时速度采样最小间隔：进度帧按事件逐条上报，降采样控制样本量 */
const SPEED_SAMPLE_INTERVAL_MS = 500
/** 实时速度样本窗口（12 个样本 ≈ 最近 6 秒） */
const SPEED_SAMPLE_WINDOW = 12
/** 实时速度估算要求的最小样本时间跨度 */
const SPEED_SAMPLE_MIN_SPAN_MS = 1000

const EMPTY_NODE_INFO: NodeInfo = {
  cpu_count: 0,
  memory_size: 0,
  available_memory_size: 0,
  available: false,
  busy: false,
  busy_task_id: '',
}

const toMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

/** 一条双向流的下行通道，由 gRPC 控制器提供 */
export interface NodeSession {
  send(frame: MasterFrame): void
  close(): void
}

/** 会话接入后交回调用方的上行入口 */
export interface SessionHandle {
  onFrame(frame: NodeFrame): void
  onClose(reason: string): void
}

interface LiveNode {
  nodeId: string
  nodeName: string
  nodeAddress: string
  version: string
  info: NodeInfo
  connectedAt: number
  lastHeartbeat: number
  /** 最近一次任务失败信息，空串表示无异常 */
  lastError: string
  busy: boolean
  busyTaskId: string
  /** 最近一次任务进度，供查看当前任务 */
  lastProgress: ProgressUpdate | null
  /** 最近一次回写库里的运行状态，避免每次心跳都写库 */
  persistedStatus: NodeStatus | null
  /** 最近一次回写库的「名称|地址」签名，一致则跳过 upsert */
  persistedSignature: string
  /** 当前下行通道，断开后置 null（记录保留，页面显示「离线」而非消失） */
  session: NodeSession | null
  /** 当前任务下发时间戳，任务结束（完成/失败/离线）后归 null */
  taskStartedAt: number | null
  /** 当前任务的实时速度采样（降采样后的进度帧） */
  speedSamples: Array<{ at: number; progress: number }>
  /** 上一次压入速度样本的时间戳 */
  lastSampleAt: number
}

/**
 * 计算节点在线注册表
 *
 * 节点以 gRPC 双向流拨出接入总服务：上行注册/心跳/任务进度，下行接收计算任务。
 * 本服务只维护「谁在线、状态如何」，不负责生成任务——下发只提供 dispatchTask 通道。
 */
@Injectable()
export class NodeRegistryService implements OnModuleInit, OnModuleDestroy {
  private readonly nodes = new Map<string, LiveNode>()
  private readonly settleListeners: Array<(taskId: string, failed: boolean) => void> = []
  private reconcileTimer: ReturnType<typeof setInterval> | null = null
  private lastMetricsWarning = 0
  private lastLogWarning = 0

  constructor(
    private readonly computeNodeService: ComputeNodeService,
    private readonly configService: ConfigService,
    // 可选注入：单测直接 new 出来的实例没有 RedisService，速度统计逻辑自动跳过
    @Optional() private readonly redisService?: RedisService,
  ) {}

  onModuleInit(): void {
    this.reconcileTimer = setInterval(() => {
      this.reconcileStatus().catch((error: unknown) => {
        console.error(`[计算节点] 状态巡检失败：${toMessage(error)}`)
      })
    }, STATUS_RECONCILE_INTERVAL_MS)
  }

  onModuleDestroy(): void {
    if (this.reconcileTimer) {
      clearInterval(this.reconcileTimer)
      this.reconcileTimer = null
    }
    for (const node of this.nodes.values()) {
      node.session?.close()
      node.session = null
    }
  }

  /**
   * 接入一条双向流，返回上行帧入口
   *
   * nodeId 在 register 帧里才出现，所以这里先按会话跟踪，注册后再绑定到节点记录。
   */
  openSession(session: NodeSession): SessionHandle {
    const state: { node: LiveNode | null; closed: boolean } = { node: null, closed: false }

    const detach = (reason: string) => {
      if (state.closed) return
      state.closed = true

      const node = state.node
      state.node = null
      // 只有仍持有当前会话的记录才置离线：同 nodeId 重连时旧会话的 detach 会被忽略
      if (!node || node.session !== session) return

      node.session = null
      if (!node.lastError) node.lastError = reason
      node.persistedStatus = 'stopped'
      this.resetTaskTiming(node)
      console.warn(`[计算节点 ${node.nodeId}] 链接断开：${reason}`)
      this.persist(this.computeNodeService.syncStatus(node.nodeId, 'stopped'), '回写离线状态')
    }

    return {
      onFrame: (frame: NodeFrame) => {
        // 注册帧缺字段这类坏帧不该把整条流带崩
        try {
          if (frame.register) {
            const node = this.bindNode(frame.register, session)
            if (!node) {
              // 注册被拒：bindNode 已回 ACK，这里收尾会话
              state.closed = true
              session.close()
              return
            }
            state.node = node
            return
          }
          if (frame.progress) {
            const node = state.node || this.nodes.get(frame.progress.node_id)
            if (node) this.applyProgress(node, frame.progress)
          }
          if (frame.logs) {
            // 优先认会话绑定的 nodeId，防止帧里伪报别的节点
            const nodeId = state.node?.nodeId || frame.logs.node_id
            this.applyLogs(nodeId, frame.logs.entries)
          }
        } catch (error: unknown) {
          console.error(`[计算节点] 处理上行帧失败：${toMessage(error)}`)
        }
      },
      onClose: detach,
    }
  }

  /**
   * 查询计算节点拓扑
   *
   * 在线节点取内存注册表；库里有 node_id 但当前未连接的记录也一并返回（离线），
   * 这样总服务重启或节点被强杀后，页面上不会「凭空消失」。
   */
  async getTopology(): Promise<IComputeNodeTopology> {
    const now = Date.now()
    const merged = new Map<string, IComputeNodeLinkInfo>()

    for (const row of await this.computeNodeService.listRegistered()) {
      if (!row.nodeId) continue
      merged.set(row.nodeId, {
        nodeId: row.nodeId,
        nodeName: row.nodeName,
        nodeAddress: row.nodeAddress,
        nodeType: row.nodeType,
        link: 'disconnected',
        busy: false,
        busyTaskId: '',
        cpuCount: 0,
        memorySize: 0,
        availableMemorySize: 0,
        connectedAt: null,
        lastHeartbeat: null,
        lastError: '',
      })
    }

    // 今日已完成任务的速度统计（Redis），读取失败不拖垮拓扑
    let speedStats = new Map<string, { avg: number | null; max: number | null; min: number | null }>()
    try {
      if (this.redisService) {
        const nodeIds = [...new Set([...merged.keys(), ...this.nodes.keys()])]
        speedStats = await readNodeCleaningSpeeds(this.redisService.getClient(), nodeIds, now)
      }
    } catch (error: unknown) {
      console.warn(`[计算节点] 清洗速度统计读取失败：${toMessage(error)}`)
    }

    for (const node of this.nodes.values()) {
      merged.set(node.nodeId, this.toLinkInfo(node, now, speedStats.get(node.nodeId)))
    }

    // 离线节点也带上今日历史速度（实时速度只有在线忙碌时才可能有）
    for (const [nodeId, info] of merged) {
      if (info.cleaningSpeed) continue
      const stats = speedStats.get(nodeId)
      info.cleaningSpeed = {
        current: null,
        avg: stats?.avg ?? null,
        max: stats?.max ?? null,
        min: stats?.min ?? null,
      }
    }

    const nodes = [...merged.values()].sort((a, b) => a.nodeId.localeCompare(b.nodeId))

    return {
      root: {
        name: this.configService.get<string>('nodeControl.name') || '总服务',
        status: 'running',
        onlineNodes: nodes.filter((item) => item.link === 'connected').length,
        totalNodes: nodes.length,
      },
      nodes,
    }
  }

  /**
   * 向指定节点下发任务
   *
   * 本次只交付这条通道，不生成也不调度任务。
   * @returns 是否成功写入下行流
   */
  dispatchTask(nodeId: string, task: ComputeTask): boolean {
    const node = this.nodes.get(nodeId)
    if (!node?.session) {
      console.warn(`[计算节点 ${nodeId}] 未在线，任务 ${task.task_id} 下发失败`)
      return false
    }

    node.session.send({ task })
    node.busy = true
    node.busyTaskId = task.task_id
    node.lastError = ''
    node.taskStartedAt = Date.now()
    node.speedSamples = []
    node.lastSampleAt = 0
    return true
  }

  /**
   * 挑选一个在线且空闲的节点，无可用节点返回 null
   */
  pickIdleNode(): string | null {
    const now = Date.now()
    for (const node of this.nodes.values()) {
      if (this.isAlive(node, now) && !node.busy) return node.nodeId
    }
    return null
  }

  /**
   * 任务落定（完成或失败）时回调，供调度器立刻补发排队任务
   */
  onTaskSettled(listener: (taskId: string, failed: boolean) => void): void {
    this.settleListeners.push(listener)
  }

  /** 把注册/心跳帧落到节点记录上，并首次接入时自动注册进 compute_node */
  private bindNode(register: NodeRegister, session: NodeSession): LiveNode | null {
    const nodeId = (register.node_id || '').trim()
    if (!nodeId) {
      session.send({ ack: { accepted: false, message: '注册帧缺少 node_id，已拒绝接入' } })
      console.warn('[计算节点] 注册帧缺少 node_id，已拒绝接入')
      return null
    }

    const now = Date.now()
    const existing = this.nodes.get(nodeId)
    // 同一 nodeId 再次接入时旧会话作废（异常重连、多副本部署都会出现）
    const stale = existing?.session && existing.session !== session ? existing.session : null
    const reconnected = !existing || !existing.session

    const node: LiveNode = existing ?? {
      nodeId,
      nodeName: register.node_name || nodeId,
      nodeAddress: register.node_address || '',
      version: register.version || '',
      info: EMPTY_NODE_INFO,
      connectedAt: now,
      lastHeartbeat: now,
      lastError: '',
      busy: false,
      busyTaskId: '',
      lastProgress: null,
      persistedStatus: null,
      persistedSignature: '',
      session,
      taskStartedAt: null,
      speedSamples: [],
      lastSampleAt: 0,
    }

    node.session = session
    if (reconnected) node.connectedAt = now
    this.applyRegister(node, register)
    this.nodes.set(nodeId, node)

    session.send({ ack: { accepted: true, message: 'ok' } })

    if (stale) {
      console.warn(`[计算节点 ${nodeId}] 出现新链接，作废旧链接`)
      stale.close()
    }

    // 心跳不写库：只有首次接入、断线重连或名称/地址变化时才 upsert
    const signature = `${node.nodeName}|${node.nodeAddress}`
    if (node.persistedStatus !== 'running' || node.persistedSignature !== signature) {
      node.persistedStatus = 'running'
      node.persistedSignature = signature
      this.persist(
        this.computeNodeService.upsertFromRegister({
          nodeId,
          nodeName: node.nodeName,
          nodeAddress: node.nodeAddress,
          status: 'running',
        }),
        '自动注册',
      )
    }
    if (reconnected) {
      console.log(`[计算节点 ${nodeId}] 已${existing ? '重新' : ''}接入（${node.nodeName}）`)
    }

    return node
  }

  private applyRegister(node: LiveNode, register: NodeRegister): void {
    if (register.node_name) node.nodeName = register.node_name
    if (register.node_address) node.nodeAddress = register.node_address
    if (register.version) node.version = register.version
    if (register.info) {
      node.info = register.info
      // 任务进度比回到注册帧更及时，忙碌态只在空闲上报时纠正
      if (!node.busy) {
        node.busy = register.info.busy
        node.busyTaskId = register.info.busy_task_id
      }
    }
    node.lastHeartbeat = Date.now()
  }

  private applyProgress(node: LiveNode, progress: ProgressUpdate): void {
    const now = Date.now()
    node.lastHeartbeat = now
    node.lastProgress = progress

    if (progress.failed) {
      node.busy = false
      node.busyTaskId = ''
      node.lastError = progress.error || '任务执行失败'
      this.resetTaskTiming(node)
      this.settleListeners.forEach(listener => listener(progress.task_id, true))
      return
    }
    if (progress.completed) {
      node.busy = false
      node.busyTaskId = ''
      // 任务跑成功即代表上次失败已成过去，红灯不应常亮
      node.lastError = ''
      this.recordTaskSpeed(node, progress, now)
      this.resetTaskTiming(node)
      this.settleListeners.forEach(listener => listener(progress.task_id, false))
      return
    }
    node.busy = true
    node.busyTaskId = progress.task_id
    // 新任务开跑，上次失败不再算「当前异常」
    node.lastError = ''
    // 实时速度采样：进度帧按事件逐条上报，降采样到每 500ms 一个样本
    if (node.taskStartedAt !== null && now - node.lastSampleAt >= SPEED_SAMPLE_INTERVAL_MS) {
      node.speedSamples.push({ at: now, progress: progress.progress })
      if (node.speedSamples.length > SPEED_SAMPLE_WINDOW) node.speedSamples.shift()
      node.lastSampleAt = now
    }
  }

  /** 任务结束（完成/失败/离线）时清空计时与采样状态 */
  private resetTaskTiming(node: LiveNode): void {
    node.taskStartedAt = null
    node.speedSamples = []
    node.lastSampleAt = 0
  }

  /**
   * 任务完成时记录速度：节点维度写入当日 hash（平均/最快/最慢展示用），
   * 清洗任务（clean: 前缀）同时写入 session 分钟桶（总览 session/s 用）。
   * 幂等重放的完成帧 target 为 0，不代表真实执行，不计入任何统计。
   */
  private recordTaskSpeed(node: LiveNode, progress: ProgressUpdate, now: number): void {
    if (!this.redisService || node.taskStartedAt === null || progress.target <= 0) return
    const durationMs = now - node.taskStartedAt
    const redisService = this.redisService
    this.recordMetric(() => recordNodeCleaningSpeed(redisService.getClient(), node.nodeId, progress.target, durationMs, now))
    if (progress.task_id.startsWith('clean:')) {
      this.recordMetric(() => recordCleaningSessionCompletion(redisService.getClient(), now))
    }
  }

  private recordMetric(write: () => Promise<void>): void {
    // 遥测失败绝不能反过来影响任务状态推进
    Promise.resolve().then(write).catch(() => {
      if (Date.now() - this.lastMetricsWarning > 60000) {
        this.lastMetricsWarning = Date.now()
        console.warn('[计算节点] 清洗速度采样未能写入 Redis，此期间采样可能不完整')
      }
    })
  }

  /**
   * 节点日志上行落 Redis 有界列表
   *
   * 与速度采样同属遥测：写失败只按分钟节流记 warn，不能影响任务状态推进；
   * 节点按 2s 周期上报，Redis 抖动期间不逐条刷错误日志。
   */
  private applyLogs(nodeId: string, entries: NodeLogEntry[]): void {
    if (!this.redisService || !nodeId || !entries?.length) return
    appendNodeLogs(this.redisService.getClient(), nodeId, entries).catch((error: unknown) => {
      if (Date.now() - this.lastLogWarning > 60000) {
        this.lastLogWarning = Date.now()
        console.warn(`[计算节点 ${nodeId}] 日志写入 Redis 失败：${toMessage(error)}`)
      }
    })
  }

  /**
   * 查询节点最近日志（按时间升序，尾部最新）
   *
   * Redis 缺失或读取失败时返回空数组：日志页按「暂无日志」展示，
   * 与拓扑接口一样不允许遥测故障拖垮只读页面。
   */
  async getNodeLogs(nodeId: string, limit: number): Promise<NodeLogEntry[]> {
    if (!this.redisService || !nodeId) return []
    try {
      return await readNodeLogs(this.redisService.getClient(), nodeId, limit)
    } catch (error: unknown) {
      console.warn(`[计算节点 ${nodeId}] 日志读取失败：${toMessage(error)}`)
      return []
    }
  }

  /** 实时速度：当前任务近期样本的首尾差分；样本不足或跨度太短返回 null */
  private currentSpeed(node: LiveNode): number | null {
    if (node.speedSamples.length < 2) return null
    const first = node.speedSamples[0]
    const last = node.speedSamples[node.speedSamples.length - 1]
    const spanMs = last.at - first.at
    if (spanMs < SPEED_SAMPLE_MIN_SPAN_MS) return null
    return (last.progress - first.progress) * 1000 / spanMs
  }

  private toLinkInfo(
    node: LiveNode,
    now: number,
    speedStats?: { avg: number | null; max: number | null; min: number | null },
  ): IComputeNodeLinkInfo {
    const alive = this.isAlive(node, now)
    const busy = alive && node.busy
    const cleaningSpeed: IComputeNodeCleaningSpeed = {
      current: busy ? this.currentSpeed(node) : null,
      avg: speedStats?.avg ?? null,
      max: speedStats?.max ?? null,
      min: speedStats?.min ?? null,
    }
    return {
      nodeId: node.nodeId,
      nodeName: node.nodeName,
      nodeAddress: node.nodeAddress,
      // 拨出接入的节点一律走 gRPC 双向流
      nodeType: 'grpc',
      link: alive ? 'connected' : 'disconnected',
      busy,
      busyTaskId: alive ? node.busyTaskId : '',
      cpuCount: node.info.cpu_count,
      cpuUsage: alive && node.info.resource_sampled ? node.info.cpu_usage : null,
      loadAverage: alive && node.info.resource_sampled ? node.info.load_average : null,
      networkBytesPerSecond: alive && node.info.network_sampled ? node.info.network_bytes_per_second : null,
      memorySize: node.info.memory_size,
      availableMemorySize: node.info.available_memory_size,
      connectedAt: alive ? node.connectedAt : null,
      lastHeartbeat: node.lastHeartbeat,
      lastError: node.lastError,
      cleaningSpeed,
    }
  }

  private isAlive(node: LiveNode, now = Date.now()): boolean {
    return Boolean(node.session) && now - node.lastHeartbeat <= this.heartbeatTimeoutMs
  }

  /**
   * 节点死亡时若仍有在途任务，按失败落定通知调度器
   *
   * 节点被强杀后永远等不到 progress 帧；不通知的话调度器的 inflight 会永久泄漏，
   * 该 (date, session) 此后再也不会被补洗。通知后清空 busy 状态，重复扫描天然幂等，
   * 保证每次死亡只通知一次。
   */
  private settleIfBusy(node: LiveNode): void {
    if (!node.busyTaskId) return
    const taskId = node.busyTaskId
    node.busy = false
    node.busyTaskId = ''
    this.resetTaskTiming(node)
    console.warn(`[计算节点 ${node.nodeId}] 节点离线，在途任务 ${taskId} 按失败落定`)
    this.settleListeners.forEach(listener => listener(taskId, true))
  }

  /** 节点被强杀时流可能迟迟不 close，靠心跳超时把库里的 running 改回来 */
  private async reconcileStatus(): Promise<void> {
    for (const node of this.nodes.values()) {
      const alive = this.isAlive(node)
      // 断流（detach 已置 session=null，persistedStatus 同步改掉，不走下面的跳变分支）
      // 与心跳超时都汇聚到这里判定死亡，所以不能只在 persistedStatus 跳变时才落定
      if (!alive) this.settleIfBusy(node)
      const status: NodeStatus = alive ? 'running' : 'stopped'
      if (node.persistedStatus === status) continue
      node.persistedStatus = status
      await this.computeNodeService.syncStatus(node.nodeId, status)
    }
  }

  /**
   * 写库失败只记日志
   *
   * 在线注册表是内存态，不能因为 MySQL 抖动就把节点的接入体验搞坏；
   * 更不能把拒绝留在 promise 上——Node 22 默认会因 unhandled rejection 退出。
   */
  private persist(promise: Promise<unknown>, action: string): void {
    promise.catch((error: unknown) => {
      console.error(`[计算节点] ${action} 写库失败：${toMessage(error)}`)
    })
  }

  private get heartbeatTimeoutMs(): number {
    return (
      Number(this.configService.get('nodeControl.heartbeatTimeoutMs')) ||
      DEFAULT_HEARTBEAT_TIMEOUT_MS
    )
  }
}
