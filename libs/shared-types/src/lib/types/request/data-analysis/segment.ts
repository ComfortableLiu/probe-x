import { IAttributionAnalysisFilter } from "./common"

/**
 * 分群条件类型
 */
export enum SegmentConditionType {
  // 行为条件（基于事件）
  BEHAVIOR = 'BEHAVIOR',
  // 属性条件（基于用户属性）
  PROPERTY = 'PROPERTY',
}

/**
 * 行为条件聚合类型
 */
export enum BehaviorAggregator {
  // 触发过
  DID = 'DID',
  // 未触发过
  DID_NOT = 'DID_NOT',
  // 触发次数
  COUNT = 'COUNT',
}

/**
 * 聚合比较方式
 */
export enum AggregatorCompareType {
  GT = 'GT',
  GTE = 'GTE',
  LT = 'LT',
  LTE = 'LTE',
  EQ = 'EQ',
}

/**
 * 时间窗口单位
 */
export enum TimeWindowUnit {
  DAY = 'DAY',
  WEEK = 'WEEK',
  MONTH = 'MONTH',
}

/**
 * 条件组合逻辑
 */
export enum ConditionLogic {
  AND = 'AND',
  OR = 'OR',
}

/**
 * 行为条件
 */
export interface IBehaviorCondition {
  type: SegmentConditionType.BEHAVIOR
  // 事件名称
  eventName: string
  // 事件过滤条件
  filters?: IAttributionAnalysisFilter[]
  // 聚合类型
  aggregator: BehaviorAggregator
  // 聚合比较方式（当 aggregator 为 COUNT 时必填）
  compareType?: AggregatorCompareType
  // 比较值（当 aggregator 为 COUNT 时必填）
  compareValue?: number
  // 时间窗口（天数）
  timeWindowDays: number
}

/**
 * 属性条件
 */
export interface IPropertyCondition {
  type: SegmentConditionType.PROPERTY
  // 属性过滤条件
  filter: IAttributionAnalysisFilter
}

/**
 * 分群条件（联合类型）
 */
export type SegmentCondition = IBehaviorCondition | IPropertyCondition

/**
 * 条件组
 */
export interface IConditionGroup {
  // 条件组合逻辑
  logic: ConditionLogic
  // 条件列表
  conditions: SegmentCondition[]
}

/**
 * 用户分群创建请求
 */
export interface ISegmentCreateReq {
  // 分群名称
  name: string
  // 分群描述
  description?: string
  // 条件组列表（组间为 AND 关系）
  conditionGroups: IConditionGroup[]
  // 时间范围
  timeRange: [`${string}-${string}-${string}`, `${string}-${string}-${string}`]
}

/**
 * 用户分群查询请求
 */
export interface ISegmentQueryReq {
  // 分群ID
  segmentId: string
  // 页码
  page?: number
  // 每页数量
  pageSize?: number
}

/**
 * 用户分群统计信息
 */
export interface ISegmentStats {
  // 分群ID
  segmentId: string
  // 分群名称
  name: string
  // 分群描述
  description?: string
  // 用户总数
  totalUsers: number
  // 创建时间
  createdAt: string
  // 更新时间
  updatedAt: string
}

/**
 * 用户分群查询响应
 */
export interface ISegmentQueryRes {
  // 分群统计信息
  stats: ISegmentStats
  // 用户列表
  users: string[]
  // 总数
  total: number
  // 页码
  page: number
  // 每页数量
  pageSize: number
}

/**
 * 用户分群导出请求
 */
export interface ISegmentExportReq {
  // 分群ID
  segmentId: string
}
