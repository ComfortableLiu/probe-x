import { IEventAnalysisReq } from "./event"
import { IFunnelAnalysisReq } from "./funnel"
import { IUserPathAnalysisReq } from "./user-path"
import { IAttributionAnalysisReq } from "./attribution"

/**
 * 看板类型枚举
 */
export enum DashboardType {
  PERSONAL = 'personal', // 个人看板
  PUBLIC = 'public',     // 公共看板
}

/**
 * 数据分析类型枚举
 */
export enum AnalysisType {
  EVENT = 'event',           // 事件分析
  FUNNEL = 'funnel',         // 漏斗分析
  USER_PATH = 'user-path',   // 用户路径分析
  ATTRIBUTION = 'attribution', // 归因分析
}

/**
 * 看板配置接口
 * 根据不同的分析类型，config 包含不同的请求参数
 */
export interface IDashboardConfig {
  // 分析类型对应的请求参数
  // 事件分析
  eventAnalysis?: IEventAnalysisReq
  // 漏斗分析
  funnelAnalysis?: IFunnelAnalysisReq
  // 用户路径分析
  userPathAnalysis?: IUserPathAnalysisReq
  // 归因分析
  attributionAnalysis?: IAttributionAnalysisReq
  // 其他配置
  [key: string]: any
}

/**
 * 创建看板请求参数
 */
export interface ICreateDashboardReq {
  name: string                                    // 看板名称
  type: DashboardType                            // 看板类型
  analysisType: AnalysisType                     // 数据分析类型
  config: IDashboardConfig                       // 看板配置
  displayChart?: boolean                         // 是否展示图表
  displayTable?: boolean                         // 是否展示表格
  permissions?: string[]                         // 权限配置（仅公共看板使用）
}

/**
 * 更新看板请求参数
 */
export interface IUpdateDashboardReq {
  id: number                                      // 看板ID
  name?: string                                   // 看板名称
  config?: IDashboardConfig                      // 看板配置
  displayChart?: boolean                         // 是否展示图表
  displayTable?: boolean                         // 是否展示表格
  permissions?: string[]                         // 权限配置（仅公共看板使用）
}

/**
 * 查询看板列表请求参数
 */
export interface IQueryDashboardListReq {
  type?: DashboardType                           // 看板类型（可选）
  analysisType?: AnalysisType                    // 数据分析类型（可选）
  page?: number                                  // 页码
  pageSize?: number                              // 每页数量
}

/**
 * 看板信息接口
 */
export interface IDashboard {
  id: number                                      // 看板ID
  name: string                                    // 看板名称
  type: DashboardType                            // 看板类型
  creatorId: number                              // 创建者ID
  creatorName: string                            // 创建者名称
  analysisType: AnalysisType                     // 数据分析类型
  config: IDashboardConfig                       // 看板配置
  displayChart: boolean                          // 是否展示图表
  displayTable: boolean                          // 是否展示表格
  permissions?: string[]                         // 权限配置（仅公共看板使用）
  createTime: string                             // 创建时间
  updateTime: string                             // 更新时间
}

/**
 * 看板列表响应数据
 */
export interface IDashboardListRes {
  list: IDashboard[]                             // 看板列表
  total: number                                  // 总数
  page: number                                   // 当前页码
  pageSize: number                               // 每页数量
}

/**
 * 查询看板数据请求参数
 * 用于在首页展示看板时，根据日期范围查询数据
 */
export interface IQueryDashboardDataReq {
  dashboardId: number                            // 看板ID
  timeRange?: [string, string]                   // 时间范围（可选，如果不传则使用看板配置中的时间范围）
}

/**
 * 看板数据响应接口
 * 根据不同的分析类型，返回不同的数据结构
 */
export interface IDashboardDataRes {
  dashboardId: number                            // 看板ID
  analysisType: AnalysisType                     // 数据分析类型
  data: any                                      // 数据内容（根据分析类型不同而不同）
  chartData?: any                                // 图表数据（如果配置了显示图表）
  tableData?: any                                // 表格数据（如果配置了显示表格）
}

/**
 * 转换为公共看板请求参数
 */
export interface IConvertToPublicDashboardReq {
  id: number                                      // 看板ID
  permissions?: string[]                         // 权限配置
}
