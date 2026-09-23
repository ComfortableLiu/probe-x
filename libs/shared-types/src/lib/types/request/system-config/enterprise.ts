import { IPageQuery, IPageResult } from "../request"

// ============================================
// 数据源配置相关类型
// ============================================

/** 数据源类型 */
export type DataSourceType = 'clickhouse' | 'mysql' | 'postgresql' | 'elasticsearch'

/** 数据源状态 */
export type DataSourceStatus = 'normal' | 'error' | 'unchecked'

/** 数据源列表项 */
export interface IDataSourceListItem {
  id: number
  datasourceName: string
  datasourceType: DataSourceType
  host: string
  port: number
  database: string
  username?: string
  status: DataSourceStatus
  lastCheckTime?: string
  description?: string
  createTime?: string
  updateTime?: string
}

/** 查询数据源列表请求参数 */
export interface IQueryDataSourceListReq extends Partial<IPageQuery> {
  datasourceName?: string
  datasourceType?: DataSourceType
}

/** 查询数据源列表响应 */
export type IQueryDataSourceListRes = IPageResult<IDataSourceListItem>

/** 创建数据源请求参数 */
export interface ICreateDataSourceReq {
  datasourceName: string
  datasourceType: DataSourceType
  host: string
  port: number
  database: string
  username?: string
  password?: string
  description?: string
}

/** 创建数据源响应数据 */
export interface ICreateDataSourceRes {
  id: number
  datasourceName: string
}

/** 更新数据源请求参数 */
export interface IUpdateDataSourceReq {
  id: number
  datasourceName?: string
  datasourceType?: DataSourceType
  host?: string
  port?: number
  database?: string
  username?: string
  password?: string
  description?: string
}

/** 更新数据源响应数据 */
export interface IUpdateDataSourceRes {
  id: number
  datasourceName: string
}

/** 删除数据源请求参数 */
export interface IDeleteDataSourceReq {
  id: number
}

/** 测试数据源连接响应 */
export interface ITestDataSourceConnectionRes {
  success: boolean
  message: string
  latency?: number
}

// ============================================
// 通知设置相关类型
// ============================================

/** 通知类型 */
export type NotificationType = 'webhook' | 'email' | 'sms'

/** 通知列表项 */
export interface INotificationListItem {
  id: number
  notificationName: string
  notificationType: NotificationType
  recipients: string
  triggerCondition?: string
  config: string
  isEnable: boolean
  lastSendTime?: string
  description?: string
  createTime?: string
  updateTime?: string
}

/** 查询通知列表请求参数 */
export interface IQueryNotificationListReq extends Partial<IPageQuery> {
  notificationName?: string
  notificationType?: NotificationType
  isEnable?: boolean
}

/** 查询通知列表响应 */
export type IQueryNotificationListRes = IPageResult<INotificationListItem>

/** 创建通知请求参数 */
export interface ICreateNotificationReq {
  notificationName: string
  notificationType: NotificationType
  recipients: string
  triggerCondition?: string
  config?: string
  isEnable?: boolean
  description?: string
}

/** 创建通知响应数据 */
export interface ICreateNotificationRes {
  id: number
  notificationName: string
}

/** 更新通知请求参数 */
export interface IUpdateNotificationReq {
  id: number
  notificationName?: string
  notificationType?: NotificationType
  recipients?: string
  triggerCondition?: string
  config?: string
  isEnable?: boolean
  description?: string
}

/** 更新通知响应数据 */
export interface IUpdateNotificationRes {
  id: number
  notificationName: string
}

/** 删除通知请求参数 */
export interface IDeleteNotificationReq {
  id: number
}

/** 测试发送通知响应 */
export interface ITestSendNotificationRes {
  success: boolean
  message: string
}

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
}

/** 节点注册/心跳帧 */
export interface NodeRegister {
  node_id: string
  node_name: string
  node_address: string
  version: string
  info?: NodeInfo
}

/** 总服务应答 */
export interface MasterAck {
  accepted: boolean
  message: string
}

/** 节点 -> 总服务 上行帧 */
export interface NodeFrame {
  register?: NodeRegister
  progress?: ProgressUpdate
}

/** 总服务 -> 节点 下行帧 */
export interface MasterFrame {
  ack?: MasterAck
  task?: ComputeTask
}

/** 计算节点链接信息（拓扑图/状态展示用） */
export interface IComputeNodeLinkInfo {
  /** 节点唯一标识 */
  nodeId: string
  /** 节点展示名 */
  nodeName: string
  /** 节点上报地址，未上报为空串 */
  nodeAddress: string
  /** 节点类型 */
  nodeType: NodeType
  /** 链接状态 */
  link: ComputeNodeLinkStatus
  /** 是否正在执行任务 */
  busy: boolean
  /** 正在执行的任务 id */
  busyTaskId: string
  /** CPU 核心数 */
  cpuCount: number
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

/** 计算节点列表项 */
export interface IComputeNodeListItem {
  id: number
  /** 节点自报标识（自动注册的节点才有） */
  nodeId?: string
  nodeName: string
  nodeAddress: string
  nodePort: number
  nodeType: NodeType
  status: NodeStatus
  weight: number
  description?: string
  createTime?: string
  updateTime?: string
}

/** 查询计算节点列表请求参数 */
export interface IQueryComputeNodeListReq extends Partial<IPageQuery> {
  nodeName?: string
  status?: NodeStatus
}

/** 查询计算节点列表响应 */
export type IQueryComputeNodeListRes = IPageResult<IComputeNodeListItem>

/** 创建计算节点请求参数 */
export interface ICreateComputeNodeReq {
  nodeName: string
  nodeAddress: string
  nodePort: number
  nodeType?: NodeType
  weight?: number
  description?: string
}

/** 创建计算节点响应数据 */
export interface ICreateComputeNodeRes {
  id: number
  nodeName: string
}

/** 更新计算节点请求参数 */
export interface IUpdateComputeNodeReq {
  id: number
  nodeName?: string
  nodeAddress?: string
  nodePort?: number
  nodeType?: NodeType
  status?: NodeStatus
  weight?: number
  description?: string
}

/** 更新计算节点响应数据 */
export interface IUpdateComputeNodeRes {
  id: number
  nodeName: string
}

/** 删除计算节点请求参数 */
export interface IDeleteComputeNodeReq {
  id: number
}

// ============================================
// 项目管理相关类型
// ============================================

/** 项目列表项 */
export interface IProjectListItem {
  id: number
  projectName: string
  projectKey: string
  description?: string
  isEnable: boolean
  memberCount: number
  createTime?: string
  updateTime?: string
}

/** 查询项目列表请求参数 */
export interface IQueryProjectListReq extends Partial<IPageQuery> {
  projectName?: string
  projectKey?: string
  isEnable?: boolean
}

/** 查询项目列表响应 */
export type IQueryProjectListRes = IPageResult<IProjectListItem>

/** 创建项目请求参数 */
export interface ICreateProjectReq {
  projectName: string
  projectKey: string
  description?: string
  isEnable?: boolean
}

/** 创建项目响应数据 */
export interface ICreateProjectRes {
  id: number
  projectName: string
  projectKey: string
}

/** 更新项目请求参数 */
export interface IUpdateProjectReq {
  id: number
  projectName?: string
  description?: string
  isEnable?: boolean
}

/** 更新项目响应数据 */
export interface IUpdateProjectRes {
  id: number
  projectName: string
}

/** 删除项目请求参数 */
export interface IDeleteProjectReq {
  id: number
}

/** 项目成员项 */
export interface IProjectMemberItem {
  userId: number
  username: string
  nickname?: string
  joinTime?: string
}

/** 添加项目成员请求参数 */
export interface IAddProjectMemberReq {
  projectId: number
  userIds: number[]
}

/** 移除项目成员请求参数 */
export interface IRemoveProjectMemberReq {
  projectId: number
  userId: number
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
