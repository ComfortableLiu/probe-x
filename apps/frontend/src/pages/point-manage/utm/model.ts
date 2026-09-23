import { createModel } from "@rematch/core"
import { IPointManageUtmState, IUtmPagination } from "./type"
import { RootModel } from "@/store/models"
import {
  deleteUtm,
  incrementUtmStat,
  queryUtmList,
  queryUtmStatCursor,
  recalcUtm,
  restoreUtm,
  syncUtmStat,
  updateUtm,
} from "./services"
import {
  IQueryUtmListReq,
  IUtmStatSyncRes,
  IUpdateUtmReq,
  UtmDimension,
  UTM_DIMENSIONS,
} from "@probe-x/shared-types/src"
import { getParamsOrQuery } from "@utils/router"
import { message } from "antd"

/** 合法的维度取值，用于把 url 里的脏值挡在外面 */
const VALID_DIMENSIONS = new Set<string>(UTM_DIMENSIONS)

/**
 * 取值可能被序列化成 "undefined" / 其它脏串，一律当「全部」处理，
 * 否则会拼进 LIKE/等值条件查出空表，用户看不出原因
 */
function normalizeDimension(raw: any): UtmDimension | undefined {
  return typeof raw === "string" && VALID_DIMENSIONS.has(raw) ? (raw as UtmDimension) : undefined
}

const initState: IPointManageUtmState = {
  utmList: [],
  pagination: {
    total: 0,
    current: 1,
    pageSize: 20,
  },
  cursor: null,
}

const pointManageUtmModel = createModel<RootModel>()({
  name: "pointManageUtmModel",
  state: initState,
  reducers: {
    updateItem(state, payload) {
      return { ...state, ...payload }
    },
  },
  effects: (dispatch) => ({
    /**
     * 查询条目列表
     * 筛选条件来自 url query（FormComponent 会写进去），是否只看已删除由视图传入
     */
    async getUtmList(payload?: { isDeleted?: boolean }) {
      const query = getParamsOrQuery()
      const params: IQueryUtmListReq = {
        dimension: normalizeDimension(query.dimension),
        value: query.value,
        alias: query.alias,
        isDeleted: payload?.isDeleted === true,
        page: query.page || 1,
        pageSize: query.pageSize || 20,
      }
      const { data } = await queryUtmList(params)
      dispatch.pointManageUtmModel.updateItem({
        utmList: data.data || [],
        pagination: {
          total: data.total || 0,
          current: data.page || params.page || 1,
          pageSize: data.pageSize || params.pageSize || 20,
        },
      })
    },

    /**
     * 查询统计游标
     */
    async getCursor() {
      const { data } = await queryUtmStatCursor()
      dispatch.pointManageUtmModel.updateItem({ cursor: data })
    },

    /**
     * 更新别名 / 描述
     */
    async updateUtm(payload: IUpdateUtmReq & { isDeleted?: boolean }) {
      const { isDeleted, ...data } = payload
      await updateUtm(data)
      message.success("保存成功")
      await dispatch.pointManageUtmModel.getUtmList({ isDeleted })
    },

    /**
     * 软删除：后续统计不再计入该取值，UTM 分析也忽略它
     */
    async deleteUtm(payload: { id: number; isDeleted?: boolean }) {
      await deleteUtm(payload.id)
      message.success("已删除，后续统计不再计入该条")
      await dispatch.pointManageUtmModel.getUtmList({ isDeleted: payload.isDeleted })
    },

    /**
     * 恢复已删除的条目
     */
    async restoreUtm(payload: { id: number; isDeleted?: boolean }) {
      await restoreUtm({ id: payload.id })
      message.success("已恢复统计（软删期间被跳过的量可点「重新统计」补回）")
      await dispatch.pointManageUtmModel.getUtmList({ isDeleted: payload.isDeleted })
    },

    /**
     * 重算单条累计统计（覆盖，不是累加）
     */
    async recalcUtm(payload: { id: number; isDeleted?: boolean }) {
      await recalcUtm({ id: payload.id })
      message.success("已重算")
      await dispatch.pointManageUtmModel.getUtmList({ isDeleted: payload.isDeleted })
    },

    /**
     * 同步统计：没游标时先做全量初始化，有游标则只刷增量
     */
    async syncStat(payload?: { isDeleted?: boolean }) {
      const { data: cursor } = await queryUtmStatCursor()
      const hasCursor = !!cursor?.cursorDate

      const { data } = hasCursor
        ? await incrementUtmStat({})
        : await syncUtmStat({})

      message.success(describeSyncResult(data, hasCursor))
      await dispatch.pointManageUtmModel.getCursor()
      await dispatch.pointManageUtmModel.getUtmList({ isDeleted: payload?.isDeleted })
    },
  }),
})

/**
 * 同步结果的人话文案
 */
function describeSyncResult(result: IUtmStatSyncRes, hasCursor: boolean) {
  const action = hasCursor ? "增量同步" : "全量初始化"
  const cutoff = result.cursorDate ? `统计截止 ${result.cursorDate}` : "游标未建立"
  if (!result || result.scanned === 0) {
    return `${action}完成：[${result.fromDate}, ${result.toDate}] 无新增数据，${cutoff}`
  }
  return (
    `${action}完成：[${result.fromDate}, ${result.toDate}] 扫描 ${result.scanned} 条，` +
    `新增 ${result.inserted}，累加 ${result.updated}` +
    (result.skipped ? `，软删跳过 ${result.skipped}` : "") +
    `；${cutoff}`
  )
}

export default pointManageUtmModel
