import { createModel } from "@rematch/core"
import { RootModel } from "@/store/models"
import { IPointManageSpmState } from "@pages/point-manage/spm/type"
import { createSpmNode, queryBusinessList, querySpmNodeList, updateSpmNode } from "@pages/point-manage/spm/services"
import { getParamsOrQuery } from "@utils/router"
import {
  ICreateSpmNodeReq,
  IQueryTrackingSpmListReq,
  ITrackingListItem,
  IUpdateSpmNodeReq,
} from "@probe-x/shared-types/src"
import { deepCopyArray } from "@probe-x/shared-utils/src"

const initState: IPointManageSpmState = {
  page: 1,
  total: 0,
  pageSize: 1,
  trackingSpmList: [],
}

const pointManageSpmModel = createModel<RootModel>()({
  name: 'pointManageSpmModel',
  state: initState,
  reducers: {
    updateItem(state, payload) {
      return {
        ...state,
        ...payload,
      }
    },

    updateSpmNodeChildren(state, payload: {
      parentCode: string,
      total: number,
      page: number,
      pageSize: number,
      child: ITrackingListItem[]
    }) {
      if (!payload.parentCode) {
        state.page = payload.page
        state.total = payload.total
        state.pageSize = payload.pageSize
        state.trackingSpmList = payload.child
        return state
      }
      const list = deepCopyArray(state.trackingSpmList)
      const q = []
      list.forEach(item => q.push(item))
      while (q.length) {
        const item = q.shift()
        if (item.code === payload.parentCode) {
          item.child = {
            total: payload.total,
            page: payload.page,
            pageSize: payload.pageSize,
            trackingSpmList: payload.child || [],
          }
          break
        } else {
          q.push(...(item.child?.trackingSpmList || []))
        }
      }
      console.log([...list])
      return {
        ...state,
        trackingSpmList: list,
      }
    },
  },
  effects: (dispatch) => ({
    async init() {
      await dispatch.pointManageSpmModel.getBusinessLines(null)
      await dispatch.pointManageSpmModel.getSpmNodeList(null)
    },
    // 获取业务线
    async getBusinessLines(_, state) {
      if (state.pointManageSpmModel?.businessList?.length) return
      const res = await queryBusinessList()
      dispatch.pointManageSpmModel.updateItem({ businessList: res.data })
    },
    // 获取SPM列表
    async getSpmNodeList(payload: { parentCode?: string, page?: number, pageSize?: number } | null) {
      const { parentCode, page = 1, pageSize = 20 } = payload || {}

      // 是否是页面
      const isPage = !payload?.parentCode

      const query = getParamsOrQuery()

      if (isPage && !query.businessCode) return

      let params: IQueryTrackingSpmListReq
      if (!isPage) {
        params = {
          parentCode,
          page,
          pageSize,
        }
      } else {
        params = {
          parentCode: query.businessCode,
          page,
          pageSize,
        }
      }
      const { data } = await querySpmNodeList(params)
      if (isPage) {
        dispatch.pointManageSpmModel.updateItem({
          total: data.total,
          page: data.page,
          pageSize: data.pageSize,
          trackingSpmList: data.data,
        })
      } else {
        dispatch.pointManageSpmModel.updateSpmNodeChildren({
          parentCode: params.parentCode,
          total: data.total,
          page: data.page,
          pageSize: data.pageSize,
          child: data.data,
        })
      }
    },
    // 创建新节点
    async createSpmNode(data: ICreateSpmNodeReq) {
      await createSpmNode(data)
    },
    // 更新节点信息
    async updateSpmNode(data: IUpdateSpmNodeReq) {
      await updateSpmNode(data)
    },
  }),
})

export default pointManageSpmModel
