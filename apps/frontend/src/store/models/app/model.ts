import { createModel } from "@rematch/core"
import { RootModel } from "@/store/models"
import { Localstorage } from "@utils/storage"
import { KEY_ACCESS_TOKEN, USER_INFO } from "@/constant/storage"
import ssoAuth from "@/lib/request/sso/ssoAuth"
import { allRoutesWithAliasMap } from "@/router"
import { IAppState, IUserInfo } from "@/store/models/app/type"
import { message } from "antd"
import queryString from "query-string"
import { queryPermissionInfo, queryUserInfo } from "@/store/models/app/services"

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
      await dispatch.appModel.initLoginInfo()
      // 初始化路由权限校验
      dispatch.appModel.initHistoryListener()
    },

    async initLoginInfo() {
      const { search, hash } = location
      const hashQuery = queryString.parse(hash)
      const query = queryString.parse(search)
      const { access_token } = hashQuery
      let token: string = Localstorage.get(KEY_ACCESS_TOKEN) || ''
      if (!token) {
        Localstorage.remove(USER_INFO)
      }

      // 存在token则刷新一次用户信息
      if (access_token) {
        Localstorage.remove(KEY_ACCESS_TOKEN)
        if (Array.isArray(access_token)) {
          Localstorage.set(KEY_ACCESS_TOKEN, access_token[0])
          token = access_token[0] as string
        } else if (typeof access_token === 'string') {
          Localstorage.set(KEY_ACCESS_TOKEN, access_token)
          token = access_token
        }
        // TODO 裸的api太暴力了，要优化
        // history.replace(`${location.pathname}?${queryString.stringify(query)}`)
        // window.location.replace(`${location.pathname}?${queryString.stringify(query)}`)
      }

      try {
        let userInfo = Localstorage.get<IUserInfo>(USER_INFO)
        if (!userInfo || !userInfo.staffId) {
          const { data } = await queryUserInfo({
            accessToken: token,
          })
          userInfo = { ...data }
        }
        Localstorage.set(USER_INFO, userInfo)
        dispatch.applicationModel.updateItem({ userInfo })

        // 拿权限
        const permissionRes = await queryPermissionInfo()
        const permissionInfo = permissionRes.data
        dispatch.applicationModel.updateItem({ permissionInfo })
      } catch (error: any) {
        console.log('error:', error)
        throw { msg: error.msg || '初始化出错', code: error.code || 400 }
      }
    },

    initHistoryListener() {
      dispatch.applicationModel.validRouter({
        pathname: window.location.pathname,
      })
    },

    // 校验路由权限
    async validRouter(payload: { pathname: string }, state) {
      const { permissionInfo } = state.appModel
      const { pathname } = payload
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
