/**
 * 埋点事件相关类型定义
 */

/**
 * 基础事件接口
 */
export interface IBaseEvent {
  id?: number;
  eventName: string;
  ip?: string;
  ua?: string;
  site: string;
  path: string;
  params?: string;
  deviceId: string;
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  logTime: Date;
  serviceTime?: Date;
}

/**
 * 原始事件数据
 */
export interface IRawEvent extends IBaseEvent {
  // 原始数据特有字段
  rawData?: any;
  source?: string;
}

/**
 * 处理过的事件数据
 */
export interface IProcessedEvent extends IBaseEvent {
  originalEventId?: number;
  processingStatus?: 'pending' | 'processing' | 'processed' | 'failed';
  processedAt?: Date;
  cleanedData?: any;
  processingMetadata?: IProcessingMetadata;
}

/**
 * 清洗后的事件数据
 */
export interface ICleanedEvent extends IBaseEvent {
  processedEventId?: number;
  originalEventId?: number;
  cleaningStatus?: 'pending' | 'cleaning' | 'completed' | 'failed';
  cleanedAt?: Date;
  finalData?: any;
  cleaningMetadata?: ICleaningMetadata;
  qualityScore?: number;
  isValid?: boolean;
  validationErrors?: string[];
}

/**
 * 处理元数据
 */
export interface IProcessingMetadata {
  userAgentInfo?: IUserAgentInfo;
  geoInfo?: IGeoInfo;
  sessionInfo?: ISessionInfo;
  pageInfo?: IPageInfo;
  processingTimestamp?: Date;
  processingDuration?: number;
}

/**
 * 清洗元数据
 */
export interface ICleaningMetadata {
  qualityScore?: number;
  validationResult?: IValidationResult;
  cleaningTimestamp?: Date;
  cleaningDuration?: number;
  anomalyDetection?: IAnomalyDetection;
  deduplication?: IDeduplication;
  dataTransformation?: IDataTransformation;
}

/**
 * 用户代理信息
 */
export interface IUserAgentInfo {
  browser?: string;
  browserVersion?: string;
  os?: string;
  osVersion?: string;
  device?: 'mobile' | 'tablet' | 'desktop';
  isBot?: boolean;
}

/**
 * 地理位置信息
 */
export interface IGeoInfo {
  country?: string;
  region?: string;
  city?: string;
  timezone?: string;
  latitude?: number;
  longitude?: number;
  isp?: string;
}

/**
 * 会话信息
 */
export interface ISessionInfo {
  sessionId?: string;
  isNewSession?: boolean;
  sessionStartTime?: Date;
  sessionDuration?: number;
  pageViews?: number;
}

/**
 * 页面信息
 */
export interface IPageInfo {
  domain?: string;
  path?: string;
  query?: string;
  hash?: string;
  fullUrl?: string;
  title?: string;
  referrer?: string;
}

/**
 * 验证结果
 */
export interface IValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

/**
 * 异常检测结果
 */
export interface IAnomalyDetection {
  timeAnomaly?: IAnomaly;
  ipAnomaly?: IAnomaly;
  uaAnomaly?: IAnomaly;
  [key: string]: IAnomaly | undefined;
}

/**
 * 异常信息
 */
export interface IAnomaly {
  type: string;
  value: any;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description?: string;
}

/**
 * 去重信息
 */
export interface IDeduplication {
  isDuplicate: boolean;
  deduplicationKey?: string;
  existingEventId?: number;
  duplicateReason?: string;
}

/**
 * 数据转换信息
 */
export interface IDataTransformation {
  eventType?: string;
  deviceType?: string;
  trafficSource?: string;
  userSegment?: string;
  [key: string]: any;
}

/**
 * 仪表板查询参数
 */
export interface IDashboardQuery {
  startDate?: string;
  endDate?: string;
  site?: string;
  groupBy?: 'hour' | 'day' | 'week' | 'month';
  limit?: number;
  offset?: number;
}

/**
 * 分析查询参数
 */
export interface IAnalyticsQuery extends IDashboardQuery {
  eventName?: string;
  deviceId?: string;
  path?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}

/**
 * 漏斗分析步骤
 */
export interface IFunnelStep {
  name: string;
  path: string;
  eventName?: string;
  conditions?: any;
}

/**
 * 漏斗分析结果
 */
export interface IFunnelResult {
  step: string;
  count: number;
  uniqueUsers: number;
  conversionRate: number;
}

/**
 * 留存分析结果
 */
export interface IRetentionResult {
  cohortDate: string;
  cohortSize: number;
  retentionRates: IRetentionRate[];
}

/**
 * 留存率
 */
export interface IRetentionRate {
  day: number;
  rate: number;
  users: number;
}

/**
 * 事件分析结果
 */
export interface IEventAnalysisResult {
  eventStats: IEventStats[];
  eventTrends: IEventTrend[];
  topEvents: ITopEvent[];
}

/**
 * 事件统计
 */
export interface IEventStats {
  eventName: string;
  totalCount: number;
  uniqueUsers: number;
  avgProcessingTime: number;
}

/**
 * 事件趋势
 */
export interface IEventTrend {
  date: string;
  eventName: string;
  count: number;
}

/**
 * 热门事件
 */
export interface ITopEvent {
  eventName: string;
  count: number;
}

/**
 * 数据导出参数
 */
export interface IExportQuery extends IAnalyticsQuery {
  format?: 'json' | 'csv' | 'excel';
  fields?: string[];
  maxRecords?: number;
}

/**
 * 数据导出结果
 */
export interface IExportResult {
  data: any[];
  total: number;
  format: string;
  exportedAt: Date;
  downloadUrl?: string;
}

/**
 * Kafka消息类型
 */
export interface IKafkaMessage {
  topic: string;
  partition?: number;
  offset?: number;
  key?: string;
  value: any;
  timestamp?: number;
  headers?: Record<string, any>;
}

/**
 * 事件处理状态
 */
export type EventProcessingStatus = 'pending' | 'processing' | 'processed' | 'failed' | 'cleaning' | 'completed';

/**
 * 数据质量等级
 */
export type DataQualityLevel = 'excellent' | 'good' | 'fair' | 'poor' | 'critical';

/**
 * 异常严重程度
 */
export type AnomalySeverity = 'low' | 'medium' | 'high' | 'critical';
