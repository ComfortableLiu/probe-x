import { createModel } from "@rematch/core"
import { RootModel } from "@/store/models"
import { Localstorage } from "@utils/storage"
import { KEY_ACCESS_TOKEN } from "@/constant/storage"
import ssoAuth from "@/lib/request/sso/ssoAuth"
import { allRoutesWithAliasMap } from "@/router"
import { IAppState } from "@/store/models/app/type"
import { message } from "antd"

const initState: IAppState = {}

export const appModel = createModel<RootModel>()({
  name: 'appModel',
  state: initState,
  reducers: {
    updateItem(state, payload) {
      return {
        ...state,
        ...payload,
      }
    },
  },
  effects: (dispatch) => ({
    async init() {
      // 初始化路由、登录信息、权限
      await dispatch.userModel.initLoginInfo()
      // 初始化路由权限校验
      dispatch.appModel.initHistoryListener()
    },

    initHistoryListener() {
      dispatch.appModel.validRouter({
        pathname: window.location.pathname,
      })
    },

    // 校验路由权限
    async validRouter(payload: { pathname: string }, state) {
      const { permissionInfo } = state.userModel
      const { pathname } = payload
      if (pathname === '/login') {
        document.title = 'ProbeX'
        return
      }
      const token = Localstorage.get(KEY_ACCESS_TOKEN)
      if (!token) {
        ssoAuth.gotoLoginPage()
        return
      }

      const page = allRoutesWithAliasMap.get(pathname)

      if (!permissionInfo[page?.key] && pathname !== '/') {
        // TODO 这里直接去首页处理太暴力了，最好有个申请权限的页面
        message.error('无权限访问')
        window.location.href = '/'
        return
      }
      const routerName = page?.name
      const showName = routerName ? `${routerName} - ` : ''
      document.title = `${showName}ProbeX`
    },
  }),
})
