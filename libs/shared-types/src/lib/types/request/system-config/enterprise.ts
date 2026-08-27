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

/** 计算节点列表项 */
export interface IComputeNodeListItem {
  id: number
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
