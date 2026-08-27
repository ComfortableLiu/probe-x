import axios, { AxiosInstance, AxiosResponse } from 'axios'
import { ErrorCode } from "@probe-x/shared-utils/src/index"
import ssoAuth from "@/lib/request/sso/ssoAuth"
import { store } from "@/store/storeContext"
import { Localstorage } from "@utils/storage"
import { KEY_ACCESS_TOKEN } from "@/constant/storage"

// 创建 axios 实例
const apiClient: AxiosInstance = axios.create({
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// 模块级单例 Promise，并发 401 共享同一次刷新
let refreshTokenPromise: Promise<unknown> | null = null

// 响应拦截器
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    return response
  },
  async (error) => {

    // 业务Code码
    const code = error?.response?.data?.code
    switch (code) {
      case ErrorCode.TOKEN_EXPIRED: {
        // 已重放过的请求不再刷新，避免死循环
        if (error.config?._retry) {
          ssoAuth.gotoLoginPage()
          return Promise.reject(error)
        }
        // 并发 401 去重，共享同一次刷新
        if (!refreshTokenPromise) {
          refreshTokenPromise = (async () => {
            try {
              await store.dispatch.userModel.actionRefreshToken()
            } finally {
              refreshTokenPromise = null
            }
          })()
        }
        try {
          await refreshTokenPromise
        } catch (e) {
          // 刷新失败，重走登录
          ssoAuth.gotoLoginPage()
          return Promise.reject(error)
        }
        // 刷新成功，带上新 token 重放原请求
        const newToken = Localstorage.get<string>(KEY_ACCESS_TOKEN)
        error.config._retry = true
        if (newToken && error.config?.headers) {
          error.config.headers.authorization = `Bearer ${newToken}`
          error.config.headers.access_token = newToken
        }
        return apiClient.request(error.config)
      }
      case ErrorCode.REFRESH_TOKEN_EXPIRED: {
        // 刷新token过期，重走登录
        ssoAuth.gotoLoginPage()
        return
      }
    }

    console.warn(error)
    // 统一处理错误
    if (error.response) {
      console.error('响应错误:', error.response.status, error.response.data)
    } else if (error.request) {
      console.error('网络错误:', error.request)
    } else {
      console.error('请求错误:', error.message)
    }
    return Promise.reject(error)
  },
)

export default apiClient
