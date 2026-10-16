import { IPageQuery, IPageResult } from "../request"

// ============================================
// 告警系统相关类型
// ============================================

/** 告警规则类型 */
export enum AlertRuleType {
  THRESHOLD = 'threshold',
  TREND = 'trend',
  ANOMALY = 'anomaly',
  EVENT = 'event',
  CUSTOM = 'custom',
}

/** 告警级别 */
export enum AlertLevel {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical',
}

/** 告警比较运算符 */
export type AlertOperator = '>' | '<' | '>=' | '<=' | '=='

/** Webhook 发送结果 */
export type AlertWebhookStatus = 'success' | 'failed'

/** 告警规则 */
export interface IAlertRule {
  id: number
  name: string
  eventName: string
  windowMinutes: number
  checkIntervalMinutes: number
  operator: AlertOperator
  threshold: number
  level: AlertLevel
  webhookUrl: string
  enabled: boolean
  lastCheckedAt?: string
  lastTriggeredAt?: string
  createUserId?: number
  createTime?: string
  updateTime?: string
}

/** 告警历史 */
export interface IAlertHistory {
  id: number
  ruleId: number
  ruleName?: string
  metricValue: number
  threshold: number
  level: AlertLevel
  webhookStatus: AlertWebhookStatus
  error?: string
  createTime: string
}

/** 查询告警规则列表请求参数 */
export interface IQueryAlertRuleListReq extends Partial<IPageQuery> {
  name?: string
  level?: AlertLevel
  enabled?: boolean
}

/** 查询告警规则列表响应 */
export type IQueryAlertRuleListRes = IPageResult<IAlertRule>

/** 创建告警规则请求参数 */
export interface ICreateAlertRuleReq {
  name: string
  eventName: string
  windowMinutes: number
  checkIntervalMinutes: number
  operator: AlertOperator
  threshold: number
  level: AlertLevel
  webhookUrl: string
  enabled?: boolean
}

/** 创建告警规则响应数据 */
export interface ICreateAlertRuleRes {
  id: number
  name: string
}

/** 更新告警规则请求参数 */
export interface IUpdateAlertRuleReq {
  id: number
  name?: string
  eventName?: string
  windowMinutes?: number
  checkIntervalMinutes?: number
  operator?: AlertOperator
  threshold?: number
  level?: AlertLevel
  webhookUrl?: string
  enabled?: boolean
}

/** 更新告警规则响应数据 */
export interface IUpdateAlertRuleRes {
  id: number
  name: string
}

/** 删除告警规则请求参数 */
export interface IDeleteAlertRuleReq {
  id: number
}

/** 启用/禁用告警规则请求参数 */
export interface IToggleAlertRuleReq {
  id: number
  enabled: boolean
}

/** 查询告警历史列表请求参数 */
export interface IQueryAlertHistoryListReq extends Partial<IPageQuery> {
  ruleId?: number
  level?: AlertLevel
  startTime?: string
  endTime?: string
}

/** 查询告警历史列表响应 */
export type IQueryAlertHistoryListRes = IPageResult<IAlertHistory>

// ============================================
// 计算节点相关类型
// ============================================

/** 节点类型 */
export type NodeType = 'grpc' | 'http'

/** 节点状态 */
export type NodeStatus = 'running' | 'stopped' | 'error'

/** 节点与总服务的链接状态 */
export type ComputeNodeLinkStatus = 'connecting' | 'connected' | 'disconnected'

// ---- 计算节点接入协议的线上帧（与 proto 消息一一对应，字段名为 snake_case）----

/** 计算任务指令 */
export interface ComputeTask {
  task_id: string
  session_id: string
  /** 格式 YYYY-MM-DD */
  date: string
  /** 仅供调度器内部使用；Rust 部分落库切片必须由 Rust 继续补齐，不进入 gRPC 协议。 */
  required_runtime?: 'rust'
}

/** 进度更新指令 */
export interface ProgressUpdate {
  task_id: string
  target: number
  progress: number
  node_id: string
  message: string
  completed: boolean
  failed: boolean
  error: string
}

/** 节点资源与运行状态 */
export interface NodeInfo {
  /** CPU 核心数 */
  cpu_count: number
  /** New senders set validity flags; old protobuf defaults must not appear as measured zeros. */
  resource_sampled?: boolean
  cpu_usage?: number
  load_average?: number
  network_sampled?: boolean
  network_bytes_per_second?: number
  /** 总内存，MB */
  memory_size: number
  /** 可用内存，MB */
  available_memory_size: number
  /** 是否可用 */
  available: boolean
  /** 是否忙碌中 */
  busy: boolean
  /** 忙碌任务 id */
  busy_task_id: string
  /** 可同时执行的任务数，可独立于 CPU 线程池容量；旧节点未上报时按 1 处理 */
  task_capacity?: number
  /** 已接受且尚未结束的任务，包含本地排队任务；busy_task_id 保留首项兼容旧端 */
  active_task_ids?: string[]
}

/** 节点注册/心跳帧 */
export interface NodeRegister {
  node_id: string
  node_name: string
  node_address: string
  version: string
  info?: NodeInfo
  /** 声明的健康检查端口，允许对外映射覆盖；0/缺省表示未知 */
  node_port?: number
  /** 实际健康检查监听地址；与连接来源 IP 含义不同 */
  health_host?: string
  /** 实际健康检查监听端口 */
  health_port?: number
}

/** 总服务应答 */
export interface MasterAck {
  accepted: boolean
  message: string
}

/** 节点日志级别 */
export type NodeLogLevel = 'log' | 'info' | 'warn' | 'error' | 'debug'

/** 日志查询级别；log 同时包含 console.info */
export type NodeLogFilter = 'all' | Exclude<NodeLogLevel, 'info'>

/** 节点日志条目 */
export interface NodeLogEntry {
  /** 留存周期内稳定的日志标识，由总服务读取时补充 */
  id?: string
  /** 毫秒时间戳 */
  ts: number
  level: NodeLogLevel
  /** 已格式化的日志文本 */
  message: string
}

/** 节点日志批量上报帧：节点侧缓冲后随 flush 定时器上行 */
export interface NodeLogBatch {
  node_id: string
  entries: NodeLogEntry[]
}

/** 节点 -> 总服务 上行帧 */
export interface NodeFrame {
  register?: NodeRegister
  progress?: ProgressUpdate
  logs?: NodeLogBatch
}

/** 总服务 -> 节点 下行帧 */
export interface MasterFrame {
  ack?: MasterAck
  task?: ComputeTask
}

/** 计算节点日志查询；不传 cursor 时读取最新一页 */
export interface IComputeNodeLogsQuery {
  /** 默认 100，最多 200 */
  limit?: number
  /** 上一页返回的游标，用于读取更早日志 */
  cursor?: string
  level?: NodeLogFilter
}

/** 计算节点日志查询响应；单页内按记录顺序排列，尾部最新 */
export interface IComputeNodeLogsRes {
  nodeId: string
  entries: NodeLogEntry[]
  /** 当前页的稳定锚点，返回历史页时可复用；空页为 null */
  pageCursor: string | null
  nextCursor: string | null
  hasMore: boolean
  retentionLimit: number
  /** 留存日志已过期或被裁剪，需要重新读取最新一页 */
  resetRequired?: boolean
}

/** 计算节点清洗速度（条/s），所有指标均合计节点的全部并发任务 */
export interface IComputeNodeCleaningSpeed {
  /** 实时处理速度（条/s），忙碌期间按节点近 6 秒合计进度估算，空闲/离线为 null */
  current: number | null
  /** 今日总处理量 / 节点忙碌墙钟时长（条/s），无有效采样为 null */
  avg: number | null
  /** 今日节点采样区间最高总处理速度（条/s），首尾按实际时长采样 */
  max: number | null
  /** 今日节点采样区间最低总处理速度（条/s），忙碌停滞可为 0 */
  min: number | null
}

/** 计算节点链接信息（拓扑图/状态展示用） */
export interface IComputeNodeLinkInfo {
  /** 节点唯一标识 */
  nodeId: string
  /** 节点展示名 */
  nodeName: string
  /** 节点上报地址，缺省以连接来源 IP 兜底 */
  nodeAddress: string
  /** 声明的健康检查端口，不用于调度连接 */
  nodePort?: number
  /** 实际健康检查监听地址，旧节点或离线恢复时可能未知 */
  healthHost?: string
  /** 实际健康检查监听端口 */
  healthPort?: number
  /** 节点类型 */
  nodeType: NodeType
  /** 链接状态 */
  link: ComputeNodeLinkStatus
  /** 是否正在执行任务 */
  busy: boolean
  /** 正在执行的任务 id */
  busyTaskId: string
  /** 节点任务并发上限 */
  taskCapacity?: number
  /** 已占用的任务槽位数 */
  activeTaskCount?: number
  /** 全部在途任务 id，busyTaskId 保留首项兼容旧版页面 */
  busyTaskIds?: string[]
  /** CPU 核心数 */
  cpuCount: number
  cpuUsage?: number | null
  loadAverage?: number | null
  networkBytesPerSecond?: number | null
  /** 总内存，MB */
  memorySize: number
  /** 可用内存，MB */
  availableMemorySize: number
  /** 链接建立时间，未连接为 null */
  connectedAt: number | null
  /** 最近一次心跳时间戳，从未上报为 null */
  lastHeartbeat: number | null
  /** 最近一次失败的任务错误信息，空串表示当前无异常 */
  lastError: string
  /** 清洗速度统计；旧版总服务不下发该字段 */
  cleaningSpeed?: IComputeNodeCleaningSpeed
}

/** 计算节点拓扑（根节点 = 总服务） */
export interface IComputeNodeTopology {
  /** 总服务自身状态 */
  root: {
    name: string
    status: 'running'
    /** 当前在线节点数 */
    onlineNodes: number
    /** 已知节点总数（含离线） */
    totalNodes: number
  }
  /** 已注册的计算节点 */
  nodes: IComputeNodeLinkInfo[]
}

// ============================================
// 审计日志相关类型
// ============================================

/** 审计日志列表项 */
export interface IAuditLogListItem {
  id: number
  userId?: number
  username: string
  action: string
  method: string
  path: string
  requestBody?: string
  responseStatus?: number
  ip?: string
  userAgent?: string
  createTime: string
}

/** 查询审计日志列表请求参数 */
export interface IQueryAuditLogListReq extends Partial<IPageQuery> {
  username?: string
  action?: string
  method?: string
  startTime?: string
  endTime?: string
}

/** 查询审计日志列表响应 */
export type IQueryAuditLogListRes = IPageResult<IAuditLogListItem>

// ============================================
// 通用设置（最终数据清洗调度）相关类型
// ============================================

/**
 * 通用设置（最终数据清洗调度）
 */
export interface IGeneralConfig {
  /** 是否启用每日定时清洗 */
  enabled: boolean
  /** 每日清洗时间，HH:mm 格式，如 02:00 */
  dailyTime: string
}

/**
 * 更新通用设置请求
 */
export type IUpdateGeneralConfigReq = IGeneralConfig

/**
 * 立即清洗请求
 */
export interface ICleanNowReq {
  /** 指定清洗日期 YYYY-MM-DD；不传则清洗全部欠账（≤昨天且未清洗的 session） */
  date?: string
}

/**
 * 立即清洗响应
 */
export interface ICleanNowRes {
  /** 请求返回时已下发的任务数，后续按容量继续分片下发 */
  dispatched: number
  /** 已加载到有界缓冲的任务数，不代表全部历史待清洗量 */
  pending: number
  /** 仍有扫描范围待分片加载 */
  loading: boolean
  /** 扫描正等待节点上线或空闲任务槽 */
  waitingForCapacity: boolean
}
