import { createModel } from "@rematch/core"
import { RootModel } from "@/store/models"
import { Localstorage } from "@utils/storage"
import { KEY_ACCESS_TOKEN, KEY_REFRESH_TOKEN, USER_INFO } from "@/constant/storage"
import { IUser, IUserModel } from "@/store/models/user/type"
import ssoAuth from "@/lib/request/sso/ssoAuth"
import { queryLogin, queryPermissionInfo } from "@/store/models/user/services"

const initState: IUserModel = {}

export const userModel = createModel<RootModel>()({
  name: 'userModel',
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
    async initLoginInfo() {
      const { pathname } = location
      if (pathname === '/login') {
        return
      }
      let accessToken: string = Localstorage.get(KEY_ACCESS_TOKEN) || ''
      let refreshToken: string = Localstorage.get(KEY_REFRESH_TOKEN) || ''
      let userInfo = Localstorage.get<IUser>(USER_INFO)

      // 如果没有登录态那就直接去登录
      if (!accessToken || !refreshToken || !userInfo?.userId) {
        ssoAuth.gotoLoginPage()
        return
      }
      dispatch.userModel.updateItem({ userInfo })

      // 拿权限
      try {
        const permissionRes = await queryPermissionInfo()
        const permissionInfo = permissionRes.data
        dispatch.userModel.updateItem({ permissionInfo })
      } catch (error: any) {
        console.log('error:', error)
        throw { msg: error.msg || '初始化出错', code: error.code || 400 }
      }
    },

    async login(payload: { username: string, password: string }) {
      try {
        const { data } = await queryLogin(payload)
        const { userInfo, refreshToken, accessToken } = data
        Localstorage.set(KEY_ACCESS_TOKEN, accessToken)
        Localstorage.set(KEY_REFRESH_TOKEN, refreshToken)
        Localstorage.set(USER_INFO, userInfo)
        dispatch.userModel.updateItem({ userInfo })
      } catch (e) {
        return Promise.reject(e)
      }
      return true
    },
  }),
})