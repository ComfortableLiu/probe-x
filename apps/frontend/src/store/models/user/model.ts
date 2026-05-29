import { createModel } from "@rematch/core"
import { RootModel } from "@/store/models"
import { Localstorage } from "@utils/storage"
import { KEY_ACCESS_TOKEN, KEY_REFRESH_TOKEN, USER_INFO } from "@/constant/storage"
import { IUserModel } from "@/store/models/user/type"
import ssoAuth from "@/lib/request/sso/ssoAuth"
import { queryLogin, queryPermissionInfo, refreshToken, getCurrentUser, updateUserProfile, changePassword } from "@/store/models/user/services"
import { IUser } from "@probe-x/shared-types/src"

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

      // TODO 看一下token的过期时间

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
      const { data } = await queryLogin(payload)
      const { userInfo, refreshToken, accessToken } = data
      Localstorage.set(KEY_ACCESS_TOKEN, accessToken)
      Localstorage.set(KEY_REFRESH_TOKEN, refreshToken)
      Localstorage.set(USER_INFO, userInfo)
      dispatch.userModel.updateItem({ userInfo })
    },
    async actionRefreshToken() {
      const refreshTokenStr = Localstorage.get<string>(KEY_REFRESH_TOKEN)
      const { data } = await refreshToken(refreshTokenStr)
      const { userInfo, refreshToken: newRefreshToken, accessToken } = data
      Localstorage.set(KEY_ACCESS_TOKEN, accessToken)
      Localstorage.set(KEY_REFRESH_TOKEN, newRefreshToken)
      Localstorage.set(USER_INFO, userInfo)
      dispatch.userModel.updateItem({ userInfo })
      // TODO 这里直接刷新页面也有点暴力了，后续优化成无感请求
      window.location.reload()
    },

    async fetchCurrentUser() {
      const { data } = await getCurrentUser()
      Localstorage.set(USER_INFO, data)
      dispatch.userModel.updateItem({ userInfo: data })
      return data
    },

    async updateProfile(payload: { email?: string; nickname?: string }) {
      const { data } = await updateUserProfile(payload)
      Localstorage.set(USER_INFO, data)
      dispatch.userModel.updateItem({ userInfo: data })
      return data
    },

    async changePassword(payload: { oldPassword?: string; newPassword: string }) {
      await changePassword(payload)
    },
  }),
})
