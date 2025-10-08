import axios, { AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { generateNonce, generateSignature } from '@utils/signature'
import { get } from "@config"
import { ErrorCode } from "@probe-x/shared-utils/src"
import ssoAuth from "@/lib/request/sso/ssoAuth"
import { store } from "@/store/storeContext"

// 密钥 - 在实际项目中应该从环境变量中获取
const SECRET_KEY = get<string>("signatureSecret") || ''

// 创建 axios 实例
const apiClient: AxiosInstance = axios.create({
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// 请求拦截器 - 添加签名
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    // 生成签名所需参数
    const timestamp = Date.now()
    const nonce = generateNonce()

    const query = {}
    if (config.params) {
      Object.keys(config.params)
        .filter(key => !!config.params[key])
        .forEach(key => {
          query[key] = `${config.params[key]}`
        })
    }

    // 生成签名
    const signature = await generateSignature({
      path: `/api${config.url}`,
      method: config.method || '',
      body: config.data,
      query,
    }, timestamp, nonce, SECRET_KEY)

    // 设置签名相关请求头
    if (config.headers) {
      config.headers['X-Signature'] = signature
      config.headers['X-Timestamp'] = timestamp.toString()
      config.headers['X-Nonce'] = nonce
    }

    return config
  },
  (error) => {
    return Promise.reject(error)
  },
)

// 响应拦截器
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    // 可以根据需要处理响应数据
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
      // 服务器返回错误状态码
      console.error('响应错误:', error.response.status, error.response.data)
    } else if (error.request) {
      // 请求发出但没有收到响应
      console.error('网络错误:', error.request)
    } else {
      // 其他错误
      console.error('请求错误:', error.message)
    }
    return Promise.reject(error)
  },
)

export default apiClient
