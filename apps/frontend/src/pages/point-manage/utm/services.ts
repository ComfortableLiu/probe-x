import request from "@/lib/request"
import {
  IQueryUtmListReq,
  IQueryUtmListRes,
  IRecalcUtmReq,
  IRestoreUtmReq,
  IUtmStatCursorRes,
  IUtmStatIncrementReq,
  IUtmStatSyncReq,
  IUtmStatSyncRes,
  IUpdateUtmReq,
} from "@probe-x/shared-types/src"

/**
 * 分页查询 UTM 条目
 */
export function queryUtmList(params: IQueryUtmListReq) {
  return request<IQueryUtmListRes>({
    url: "/utm/list",
    method: "get",
    params,
  })
}

/**
 * 更新别名 / 描述
 */
export function updateUtm(data: IUpdateUtmReq) {
  return request<IUpdateUtmReq>({
    url: "/utm/update",
    method: "post",
    data,
  })
}

/**
 * 软删除（不物理删除，后续统计不再计入该取值）
 */
export function deleteUtm(id: number) {
  return request({
    url: "/utm/delete",
    method: "post",
    data: { id },
  })
}

/**
 * 恢复已删除的条目
 */
export function restoreUtm(data: IRestoreUtmReq) {
  return request({
    url: "/utm/restore",
    method: "post",
    data,
  })
}

/**
 * 重算单条累计统计（覆盖，不是累加）
 */
export function recalcUtm(data: IRecalcUtmReq) {
  return request({
    url: "/utm/recalc",
    method: "post",
    data,
  })
}

/**
 * 全量初始化统计
 */
export function syncUtmStat(data: IUtmStatSyncReq = {}) {
  return request<IUtmStatSyncRes>({
    url: "/utm/stat/sync",
    method: "post",
    data,
  })
}

/**
 * 增量统计
 */
export function incrementUtmStat(data: IUtmStatIncrementReq = {}) {
  return request<IUtmStatSyncRes>({
    url: "/utm/stat/increment",
    method: "post",
    data,
  })
}

/**
 * 查询统计游标
 */
export function queryUtmStatCursor() {
  return request<IUtmStatCursorRes>({
    url: "/utm/stat/cursor",
    method: "get",
  })
}
