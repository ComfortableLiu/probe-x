import { IPageQuery, IPageResult } from "./request"
import { UtmDimension } from "../entity"

/**
 * UTM 条目
 * 一行 = 某个维度下的一个取值，带用户维护的别名/描述与累计统计
 */
export interface IUtmItem {
  id: number
  // UTM 维度
  dimension: UtmDimension
  // UTM 原始取值（大小写敏感）
  value: string
  // 别名（用户维护的可读名称）
  alias?: string
  // 描述
  description?: string
  // 累计事件数（每日累加，精确）
  eventCount: number
  // 首次出现日期 YYYY-MM-DD
  firstSeenDate?: string
  // 末次出现日期 YYYY-MM-DD
  lastSeenDate?: string
  // 软删除标记：不物理删除，标记后增量统计不再计入该取值
  isDeleted: boolean
  // 删除时间
  deletedAt?: string
  // 删除用户ID
  deletedUserId?: number

  createTime?: string
  createUserId?: number
  createUsername?: string
  createNickname?: string

  updateTime?: string
  updateUserId?: number
  updateUsername?: string
  updateNickname?: string
}

/**
 * 查询 UTM 条目列表
 */
export interface IQueryUtmListReq extends Partial<IPageQuery> {
  // 维度，不传查全部维度
  dimension?: UtmDimension
  // 取值模糊匹配
  value?: string
  // 别名模糊匹配
  alias?: string
  // 是否只看已删除，不传按有效条目查
  isDeleted?: boolean
}

export type IQueryUtmListRes = IPageResult<IUtmItem>

/**
 * 更新 UTM 别名 / 描述
 * 取值本身来自埋点上报，不允许改
 */
export interface IUpdateUtmReq {
  id: number
  alias?: string
  description?: string
}

export type IUpdateUtmRes = IUtmItem

/**
 * 软删除 UTM 条目
 * 技术上不物理删除；标记后后续统计不再计入该取值，UTM 分析也忽略它
 */
export interface IDeleteUtmReq {
  id: number
}

/**
 * 恢复已删除的 UTM 条目
 */
export interface IRestoreUtmReq {
  id: number
}

export type IRestoreUtmRes = IUtmItem

/**
 * 重算单条 UTM 的累计统计
 * 恢复软删后用来补回被跳过的区间（重算覆盖，不是累加）
 */
export interface IRecalcUtmReq {
  id: number
}

export type IRecalcUtmRes = IUtmItem

/**
 * 统计同步结果
 */
export interface IUtmStatSyncRes {
  // 统计起始日期 YYYY-MM-DD
  fromDate: string
  // 统计截止日期 YYYY-MM-DD
  toDate: string
  // 扫描到的 (维度, 取值) 组合数
  scanned: number
  // 新插入的条目数
  inserted: number
  // 累加更新的条目数
  updated: number
  // 因软删除而跳过、未再计入的条目数
  skipped: number
  // 统计后的游标日期 YYYY-MM-DD，区间为空且从未统计过时为 null
  cursorDate: string | null
}

/**
 * 全量初始化统计（首次刷数用）
 */
export interface IUtmStatSyncReq {
  // 起始日期 YYYY-MM-DD，缺省取 ClickHouse 里最早的数据日期
  dateFrom?: string
  // 截止日期 YYYY-MM-DD，缺省取目标日
  dateTo?: string
}

export type IUtmStatSyncResData = IUtmStatSyncRes

/**
 * 增量统计（每日任务与手动补跑用）
 */
export interface IUtmStatIncrementReq {
  // 截止日期 YYYY-MM-DD，缺省取目标日
  dateTo?: string
}

/**
 * 统计游标
 */
export interface IUtmStatCursorRes {
  // 已统计到的日期（含）YYYY-MM-DD，从未统计为 null
  cursorDate: string | null
  // 游标更新时间，从未统计为 null
  updateTime: string | null
  // 每日统计的截止日相对今天的偏移
  targetOffset: number
}

/**
 * UTM 取值选项
 * UTM 分析的取值筛选器用，只含有效条目，一次性返回不分页
 */
export interface IUtmOptionItem {
  id: number
  // UTM 维度
  dimension: UtmDimension
  // UTM 原始取值
  value: string
  // 别名（用户维护的可读名称）
  alias?: string
  // 累计事件数，用来把投放量大的取值排在前面
  eventCount: number
}

/**
 * 查询 UTM 取值选项
 */
export interface IQueryUtmOptionsReq {
  // 维度，不传返回全部维度
  dimension?: UtmDimension
}

export type IQueryUtmOptionsRes = IUtmOptionItem[]
