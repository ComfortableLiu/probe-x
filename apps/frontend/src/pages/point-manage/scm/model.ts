import { createModel } from "@rematch/core"
import { RootModel } from "@/store/models"
import { IPointManageScmState } from "@pages/point-manage/scm/type"
import { createScmNode, queryScmNodeList, updateScmNode } from "@pages/point-manage/scm/services"
import {
  ICreateSpmNodeReq,
  IQueryTrackingSpmListReq,
  ITrackingListItem,
  IUpdateSpmNodeReq,
} from "@probe-x/shared-types/src"

const initState: IPointManageScmState = {
  page: 1,
  total: 0,
  pageSize: 1,
  trackingScmList: [],
}

const pointManageScmModel = createModel<RootModel>()({
  name: 'pointManageScmModel',
  state: initState,
  reducers: {
    updateItem(state, payload) {
      return {
        ...state,
        ...payload,
      }
    },

    updateScmNodeChildren(state, payload: {
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
        state.trackingScmList = payload.child
        return state
      }
      const list = [...state.trackingScmList]
      const q = []
      list.forEach(item => q.push(item))
      while (q.length) {
        const item = q.shift()
        if (item.code === payload.parentCode) {
          item.child = {
            total: payload.total,
            page: payload.page,
            pageSize: payload.pageSize,
            trackingScmList: payload.child || [],
          }
          break
        } else {
          q.push(...(item.child?.trackingScmList || []))
        }
      }
      return {
        ...state,
        trackingScmList: list,
      }
    },
  },
  effects: (dispatch) => ({
    async init() {
      await dispatch.pointManageScmModel.getScmNodeList(null)
    },
    // 获取SCM列表
    async getScmNodeList(payload: { parentCode?: string | null, page?: number, pageSize?: number } | null) {
      const { parentCode, page = 1, pageSize = 20 } = payload || {}

      // 是否是第一级（A）
      const isLevel1 = !payload?.parentCode

      let params: IQueryTrackingSpmListReq
      if (!isLevel1) {
        params = {
          parentCode,
          page,
          pageSize,
        }
      } else {
        params = {
          parentCode: null,
          page,
          pageSize,
        }
      }
      const { data } = await queryScmNodeList(params)
      if (isLevel1) {
        dispatch.pointManageScmModel.updateItem({
          total: data.total,
          page: data.page,
          pageSize: data.pageSize,
          trackingScmList: data.data,
        })
      } else {
        dispatch.pointManageScmModel.updateScmNodeChildren({
          parentCode: params.parentCode,
          total: data.total,
          page: data.page,
          pageSize: data.pageSize,
          child: data.data,
        })
      }
    },
    // 创建新节点
    async createScmNode(data: ICreateSpmNodeReq) {
      await createScmNode(data)
    },
    // 更新节点信息
    async updateScmNode(data: IUpdateSpmNodeReq) {
      await updateScmNode(data)
    },
  }),
})

export default pointManageScmModel
