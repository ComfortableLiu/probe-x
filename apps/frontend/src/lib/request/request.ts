import axios, { AxiosInstance, AxiosResponse } from 'axios'
import { ErrorCode } from "@probe-x/shared-utils/src/index"
import ssoAuth from "@/lib/request/sso/ssoAuth"
import { store } from "@/store/storeContext"

// 创建 axios 实例
const apiClient: AxiosInstance = axios.create({
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// 响应拦截器
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    return response
  },
  (error) => {

    // 业务Code码
    const code = error?.response?.data?.code
    switch (code) {
      case ErrorCode.TOKEN_EXPIRED: {
        // 重新请求登录token
        store.dispatch.userModel.actionRefreshToken()
        return
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
