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
  metricsWindow,
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
/** 节点处理进度按 500ms 桶累计，跨连续 session 保留近 6 秒的处理量。 */
const SPEED_BUCKET_MS = 500
const SPEED_WINDOW_MS = 6000
const TOTAL_SPEED_SAMPLE_INTERVAL_MS = 1000
/** 防止重连时滞后的活跃列表恢复刚完成的任务，同时保持长跑内存有界 */
const FINISHED_TASK_HISTORY_LIMIT = 1000

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

interface ActiveTask {
  task?: ComputeTask
  startedAt: number | null
  /** 已计入节点处理量的单调进度；恢复任务的首帧只建立基线。 */
  creditedProgress: number | null
  lastProgress: ProgressUpdate | null
  /** 重连时仅由心跳恢复的占用不重复通知调度器 */
  notifySettlement: boolean
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
  /** 下发前预占容量，各任务的进度与计时互不影响 */
  activeTasks: Map<string, ActiveTask>
  finishedTaskIds: Set<string>
  speedWindowStartedAt: number | null
  speedBuckets: Array<{ at: number; events: number }>
  /** 所有并发任务共用一个忙碌墙钟，不能累加各任务的重叠耗时。 */
  speedSampleStartedAt: number | null
  speedSampleEvents: number
  speedSampleHasWork: boolean
  /** 最近一次回写库里的运行状态，避免每次心跳都写库 */
  persistedStatus: NodeStatus | null
  /** 最近一次回写库的「名称|地址」签名，一致则跳过 upsert */
  persistedSignature: string
  /** 当前下行通道，断开后置 null（记录保留，页面显示「离线」而非消失） */
  session: NodeSession | null
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
  private readonly capacityListeners: Array<() => void> = []
  private reconcileTimer: ReturnType<typeof setInterval> | null = null
  private speedSampleTimer: ReturnType<typeof setInterval> | null = null
  private lastMetricsWarning = 0
  private lastLogWarning = 0

  constructor(
    private readonly computeNodeService: ComputeNodeService,
    private readonly configService: ConfigService,
    // 可选注入：单测直接 new 出来的实例没有 RedisService，速度统计逻辑自动跳过
    @Optional() private readonly redisService?: RedisService,
  ) {}

  onModuleInit(): void {
    if (this.redisService) {
      this.speedSampleTimer = setInterval(() => this.sampleTotalSpeeds(), TOTAL_SPEED_SAMPLE_INTERVAL_MS)
    }
    this.reconcileTimer = setInterval(() => {
      this.reconcileStatus().catch((error: unknown) => {
        console.error(`[计算节点] 状态巡检失败：${toMessage(error)}`)
      })
    }, STATUS_RECONCILE_INTERVAL_MS)
  }

  onModuleDestroy(): void {
    if (this.speedSampleTimer) {
      clearInterval(this.speedSampleTimer)
      this.speedSampleTimer = null
    }
    if (this.reconcileTimer) {
      clearInterval(this.reconcileTimer)
      this.reconcileTimer = null
    }
    for (const node of this.nodes.values()) {
      this.finishTotalSpeed(node, Math.min(Date.now(), node.lastHeartbeat + this.heartbeatTimeoutMs))
      node.session?.close()
      node.session = null
      this.resetCurrentSpeed(node)
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

      this.finishTotalSpeed(node, Math.min(Date.now(), node.lastHeartbeat + this.heartbeatTimeoutMs))
      node.session = null
      if (!node.lastError) node.lastError = reason
      node.persistedStatus = 'stopped'
      console.warn(`[计算节点 ${node.nodeId}] 链接断开：${reason}`)
      this.persist(this.computeNodeService.syncStatus(node.nodeId, 'stopped'), '回写离线状态')
    }

    return {
      onFrame: (frame: NodeFrame) => {
        // 被替换的旧流不得把迟到的注册/进度应用到当前连接。
        if (state.closed || (state.node && state.node.session !== session)) return
        // 注册帧缺字段这类坏帧不该把整条流带崩
        try {
          if (frame.register) {
            const existing = this.nodes.get(frame.register.node_id)
            const previousCapacity = existing && this.isAlive(existing)
              ? this.taskCapacity(existing) - existing.activeTasks.size
              : 0
            // 换流后的首帧是恢复快照：断连期间完成且终态帧丢失的任务不会再上报。
            // 仅在这里对账，普通心跳仍不能覆盖本地刚预占的任务。
            const reportedIds = new Set(this.reportedTaskIds(frame.register.info))
            const recovering = existing && (existing.session !== session || !this.isAlive(existing))
            const missingTasks = recovering && frame.register.info
              ? [...existing.activeTasks.entries()].filter(([taskId]) => !reportedIds.has(taskId))
              : []
            const node = this.bindNode(frame.register, session)
            if (!node) {
              // 注册被拒：bindNode 已回 ACK，这里收尾会话
              state.closed = true
              session.close()
              return
            }
            state.node = node
            for (const [taskId] of missingTasks) node.activeTasks.delete(taskId)
            // 必须先绑定新流并释放所有缺失占用，再让调度器重试/补位。
            for (const [taskId, active] of missingTasks) {
              if (active.notifySettlement) {
                this.settleListeners.forEach(listener => listener(taskId, true))
              }
            }
            if (this.taskCapacity(node) - node.activeTasks.size > previousCapacity) {
              this.capacityListeners.forEach(listener => listener())
            }
            if (node.activeTasks.size === 0) {
              this.finishTotalSpeed(node, Date.now())
              this.resetCurrentSpeed(node)
            }
            return
          }
          if (frame.progress) {
            const node = state.node
            if (node && frame.progress.node_id === node.nodeId) this.applyProgress(node, frame.progress)
          }
          if (frame.logs) {
            if (state.node) this.applyLogs(state.node.nodeId, frame.logs.entries)
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
        busyTaskIds: [],
        activeTaskCount: 0,
        taskCapacity: 1,
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
    if (!node || !this.isAlive(node) || node.activeTasks.size >= this.taskCapacity(node)
      || node.activeTasks.has(task.task_id)) {
      console.warn(`[计算节点 ${nodeId}] 未在线或容量已满，任务 ${task.task_id} 下发失败`)
      return false
    }

    // send 可能同步回调或抛错，必须先预占，再在失败时回滚。
    const now = Date.now()
    if (node.speedWindowStartedAt === null) node.speedWindowStartedAt = now
    this.beginTotalSpeed(node, now)
    node.activeTasks.set(task.task_id, {
      task,
      startedAt: now,
      creditedProgress: 0,
      lastProgress: null,
      notifySettlement: true,
    })
    node.finishedTaskIds.delete(task.task_id)
    try {
      node.session.send({ task })
      node.lastError = ''
      return true
    } catch (error: unknown) {
      node.activeTasks.delete(task.task_id)
      if (node.activeTasks.size === 0) {
        this.finishTotalSpeed(node, now)
        this.resetCurrentSpeed(node)
      }
      node.lastError = toMessage(error)
      console.warn(`[计算节点 ${nodeId}] 任务 ${task.task_id} 下发失败：${node.lastError}`)
      return false
    }
  }

  /**
   * 挑选一个在线且还有任务容量的节点，旧节点默认容量为 1。
   */
  pickIdleNode(): string | null {
    const now = Date.now()
    for (const node of this.nodes.values()) {
      if (this.isAlive(node, now) && node.activeTasks.size < this.taskCapacity(node)) return node.nodeId
    }
    return null
  }

  /**
   * 任务落定（完成或失败）时回调，供调度器立刻补发排队任务
   */
  onTaskSettled(listener: (taskId: string, failed: boolean) => void): void {
    this.settleListeners.push(listener)
  }

  onCapacityAvailable(listener: () => void): void {
    this.capacityListeners.push(listener)
  }

  /** 总服务重启后，从节点恢复的切片同样不能再次下发。 */
  hasActiveSlice(date: string, sessionId: string): boolean {
    for (const node of this.nodes.values()) {
      for (const active of node.activeTasks.values()) {
        if (active.task?.date === date && active.task.session_id === sessionId) return true
      }
    }
    return false
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
    const reconnected = !existing || existing.session !== session || !this.isAlive(existing)

    const node: LiveNode = existing ?? {
      nodeId,
      nodeName: register.node_name || nodeId,
      nodeAddress: register.node_address || '',
      version: register.version || '',
      info: EMPTY_NODE_INFO,
      connectedAt: now,
      lastHeartbeat: now,
      lastError: '',
      activeTasks: new Map(),
      finishedTaskIds: new Set(),
      speedWindowStartedAt: null,
      speedBuckets: [],
      speedSampleStartedAt: null,
      speedSampleEvents: 0,
      speedSampleHasWork: false,
      persistedStatus: null,
      persistedSignature: '',
      session,
    }

    node.session = session
    if (reconnected) {
      this.finishTotalSpeed(node, Math.min(now, node.lastHeartbeat + this.heartbeatTimeoutMs))
      node.connectedAt = now
      this.resetCurrentSpeed(node)
      // 断连期间的处理量不可作为刚重连后的瞬时吞吐。
      for (const active of node.activeTasks.values()) active.creditedProgress = null
    }
    this.applyRegister(node, register, reconnected)
    if (node.activeTasks.size > 0 && node.speedWindowStartedAt === null) node.speedWindowStartedAt = now
    if (node.activeTasks.size > 0) this.beginTotalSpeed(node, now)
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

  private applyRegister(node: LiveNode, register: NodeRegister, restoreTasks: boolean): void {
    if (register.node_name) node.nodeName = register.node_name
    if (register.node_address) node.nodeAddress = register.node_address
    if (register.version) node.version = register.version
    if (register.info) {
      node.info = register.info
      // 常规心跳可能滞后，绝不能删掉下发时预占的任务，或重新加入刚完成的任务。
      // 新流注册时合并仍活跃的任务，以恢复总服务重启/节点重连期间的容量占用。
      if (restoreTasks) {
        for (const taskId of this.reportedTaskIds(register.info)) {
          if (!taskId || node.activeTasks.has(taskId) || node.finishedTaskIds.has(taskId)) continue
          node.activeTasks.set(taskId, {
            task: this.restoreCleaningTask(taskId),
            startedAt: null,
            creditedProgress: null,
            lastProgress: null,
            notifySettlement: false,
          })
        }
      }
    }
    node.lastHeartbeat = Date.now()
  }

  private applyProgress(node: LiveNode, progress: ProgressUpdate): void {
    const active = node.activeTasks.get(progress.task_id)
    // 未知任务、重复完成帧均不改变其他任务，也不重复通知调度器。
    if (!active) return
    const now = Date.now()
    if (!this.isAlive(node, now) || node.speedSampleStartedAt === null) {
      this.finishTotalSpeed(node, Math.min(now, node.lastHeartbeat + this.heartbeatTimeoutMs))
      this.resetCurrentSpeed(node)
      node.speedWindowStartedAt = now
      this.beginTotalSpeed(node, now)
      for (const task of node.activeTasks.values()) task.creditedProgress = null
    }
    node.lastHeartbeat = now
    active.lastProgress = progress
    // 这是处理进度估算：只计每个任务的新增进度，完成帧仅补齐未上报的尾段。
    // 失败不补 target；已观察到的处理工作仍保留在节点窗口里。
    if (!progress.failed) this.creditTaskProgress(node, active, progress, now)

    if (progress.failed || progress.completed) {
      node.activeTasks.delete(progress.task_id)
      node.finishedTaskIds.add(progress.task_id)
      if (node.finishedTaskIds.size > FINISHED_TASK_HISTORY_LIMIT) {
        node.finishedTaskIds.delete(node.finishedTaskIds.values().next().value)
      }
      node.lastError = progress.failed ? progress.error || '任务执行失败' : ''
      if (!progress.failed) this.recordSessionCompletion(active, progress, now)
      if (active.notifySettlement) {
        this.settleListeners.forEach(listener => listener(progress.task_id, progress.failed))
      }
      this.capacityListeners.forEach(listener => listener())
      // 补位是同步回调，必须等它完成后判断是否真的空闲。
      if (node.activeTasks.size === 0) {
        this.finishTotalSpeed(node, now)
        this.resetCurrentSpeed(node)
      }
      return
    }
    // 新任务开跑，上次失败不再算「当前异常」
    node.lastError = ''
  }

  private creditTaskProgress(node: LiveNode, active: ActiveTask, progress: ProgressUpdate, now: number): void {
    this.rollNodeSpeedDay(node, now)
    const target = Number(progress.target)
    if (!Number.isFinite(target) || target <= 0) return
    node.speedSampleHasWork = true
    const processed = progress.completed ? target : Math.min(target, Math.max(0, Number(progress.progress) || 0))
    if (!Number.isFinite(processed)) return
    if (active.creditedProgress === null) {
      // 重连时无从知道此前处理了多少，首帧作为基线，不能把历史进度当成刚处理的量。
      active.creditedProgress = processed
      return
    }
    const delta = Math.max(0, processed - active.creditedProgress)
    active.creditedProgress = Math.max(active.creditedProgress, processed)
    if (delta === 0) return
    node.speedSampleEvents += delta
    if (node.speedWindowStartedAt === null) node.speedWindowStartedAt = now
    this.pruneSpeedBuckets(node, now)
    const at = Math.floor(now / SPEED_BUCKET_MS) * SPEED_BUCKET_MS
    const previous = node.speedBuckets[node.speedBuckets.length - 1]
    if (previous?.at === at) previous.events += delta
    else node.speedBuckets.push({ at, events: delta })
  }

  private pruneSpeedBuckets(node: LiveNode, now: number): void {
    // 与当前桶一起保留最近 12 个桶，内存大小不随 session 数量增长。
    const cutoff = Math.floor(now / SPEED_BUCKET_MS) * SPEED_BUCKET_MS - SPEED_WINDOW_MS
    node.speedBuckets = node.speedBuckets.filter(bucket => bucket.at > cutoff)
  }

  private resetCurrentSpeed(node: LiveNode): void {
    node.speedWindowStartedAt = null
    node.speedBuckets = []
  }

  private beginTotalSpeed(node: LiveNode, now: number): void {
    if (node.speedSampleStartedAt !== null) return
    node.speedSampleStartedAt = now
    node.speedSampleEvents = 0
    node.speedSampleHasWork = false
  }

  /** 自然日切换前先结算旧日观察量，新到达的进度只属于新一天。 */
  private rollNodeSpeedDay(node: LiveNode, now: number): void {
    if (node.speedSampleStartedAt === null) return
    while (metricsWindow(node.speedSampleStartedAt).today !== metricsWindow(now).today
      && now > node.speedSampleStartedAt) {
      const boundary = metricsWindow(node.speedSampleStartedAt).dayStart + 86400000
      this.writeTotalSpeedSample(node, boundary, boundary - 1)
    }
  }

  private writeTotalSpeedSample(node: LiveNode, end: number, dayTimestamp = end): void {
    if (node.speedSampleStartedAt === null || end < node.speedSampleStartedAt
      || (end === node.speedSampleStartedAt && node.speedSampleEvents === 0)) return
    // 定时采样和终态可能落在同一毫秒，尾段有事件时按时钟的 1ms 精度保留计数。
    const durationMs = Math.max(1, end - node.speedSampleStartedAt)
    const events = node.speedSampleEvents
    node.speedSampleStartedAt = end
    node.speedSampleEvents = 0
    if (!this.redisService || !node.speedSampleHasWork) return
    const redisService = this.redisService
    this.recordMetric(() => recordNodeCleaningSpeed(redisService.getClient(), node.nodeId, events, durationMs, dayTimestamp))
  }

  /** 定时独立采样，页面是否打开以及任务完成先后均不改变统计分母。 */
  private sampleTotalSpeeds(now = Date.now()): void {
    for (const node of this.nodes.values()) {
      if (!this.isAlive(node, now)) {
        this.finishTotalSpeed(node, Math.min(now, node.lastHeartbeat + this.heartbeatTimeoutMs))
        continue
      }
      if (node.activeTasks.size === 0 || node.speedSampleStartedAt === null) continue
      this.rollNodeSpeedDay(node, now)
      if (now - node.speedSampleStartedAt >= TOTAL_SPEED_SAMPLE_INTERVAL_MS) {
        // 尚未看到真实任务的 target 时保留观察起点，避免把查询耗时漏掉。
        if (node.speedSampleHasWork) this.writeTotalSpeedSample(node, now)
      }
    }
  }

  private finishTotalSpeed(node: LiveNode, now: number): void {
    this.rollNodeSpeedDay(node, now)
    this.writeTotalSpeedSample(node, now)
    node.speedSampleStartedAt = null
    node.speedSampleEvents = 0
    node.speedSampleHasWork = false
  }

  private taskCapacity(node: LiveNode): number {
    const capacity = Number(node.info.task_capacity)
    return Number.isFinite(capacity) && capacity >= 1 ? Math.floor(capacity) : 1
  }

  private reportedTaskIds(info?: NodeInfo): string[] {
    if (!info) return []
    return info.active_task_ids?.length
      ? info.active_task_ids
      : info.busy_task_id ? [info.busy_task_id] : []
  }

  private restoreCleaningTask(taskId: string): ComputeTask | undefined {
    if (!taskId.startsWith('clean:')) return undefined
    const parts = taskId.replace(/:r\d+$/, '').split(':')
    if (parts.length < 4 || !/^\d{4}-\d{2}-\d{2}$/.test(parts[2])) return undefined
    return { task_id: taskId, date: parts[2], session_id: parts.slice(3).join(':') }
  }

  /**
   * 清洗任务（clean: 前缀）成功完成时写入 session 分钟桶（总览 session/s 用）。
   * 幂等重放的完成帧 target 为 0，不代表真实执行，不计入任何统计。
   */
  private recordSessionCompletion(active: ActiveTask, progress: ProgressUpdate, now: number): void {
    if (!this.redisService || active.startedAt === null || progress.target <= 0) return
    const redisService = this.redisService
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

  /** 近 6 秒处理事件数 / 观察时长；启动阶段至少使用 500ms 分母，避免瞬时尖峰。 */
  private currentSpeed(node: LiveNode, now: number): number | null {
    if (node.speedWindowStartedAt === null) return null
    this.pruneSpeedBuckets(node, now)
    const spanMs = Math.max(SPEED_BUCKET_MS, Math.min(SPEED_WINDOW_MS, now - node.speedWindowStartedAt))
    const events = node.speedBuckets.reduce((sum, bucket) => sum + bucket.events, 0)
    return events * 1000 / spanMs
  }

  private toLinkInfo(
    node: LiveNode,
    now: number,
    speedStats?: { avg: number | null; max: number | null; min: number | null },
  ): IComputeNodeLinkInfo {
    const alive = this.isAlive(node, now)
    if (!alive) this.resetCurrentSpeed(node)
    const busyTaskIds = alive ? [...node.activeTasks.keys()] : []
    const busy = busyTaskIds.length > 0
    const cleaningSpeed: IComputeNodeCleaningSpeed = {
      current: busy ? this.currentSpeed(node, now) : null,
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
      busyTaskId: busyTaskIds[0] || '',
      busyTaskIds,
      activeTaskCount: busyTaskIds.length,
      taskCapacity: this.taskCapacity(node),
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
    const tasks = [...node.activeTasks.entries()]
    // 回调会立刻尝试补发，先一次性释放本节点全部任务。
    this.finishTotalSpeed(node, Math.min(Date.now(), node.lastHeartbeat + this.heartbeatTimeoutMs))
    node.activeTasks.clear()
    this.resetCurrentSpeed(node)
    for (const [taskId, active] of tasks) {
      if (!active.notifySettlement) continue
      console.warn(`[计算节点 ${node.nodeId}] 节点离线，在途任务 ${taskId} 按失败落定`)
      this.settleListeners.forEach(listener => listener(taskId, true))
    }
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
