import React from 'react'
import { IOption, IResult } from './type'
// import env from '@/patch/env'
import { Button, message } from "antd"
import { Localstorage } from "@utils/storage"
import { IAnyObj } from "@probe-x/shared-types/src/index"
import HoverBtn from "@/components/HoverBtn"
import { clipboard, LoadingToast } from "@/utils"
import { KEY_ACCESS_TOKEN } from "@/constant/storage"
import apiClient from "@/lib/request/request"
import { get } from "@config"

const defaultTarget = '/'
const API_BASE_URL = get<string>("apiBaseUrl") || ''

/**
 * 填充进去一些基本参数，如SSO参数等
 * @param options
 */
const getConfig = async (options: IOption) => {
  const { baseURL = API_BASE_URL, target = defaultTarget, data = {}, params = {} } = options

  const token = Localstorage.get<string>(KEY_ACCESS_TOKEN)

  const headers: { [key: string]: string } = {
    'content-type': 'application/json',
    ...options?.headers,
  }
  if (token && typeof token === 'string') {
    headers['authorization'] = `Bearer ${token}`
    headers['access_token'] = token
  }

  options.data = data
  options.params = params
  if (options.method === 'get' && data) {
    options.params = { ...params, ...data }
    delete options.data
  }
  if (options.method === 'post' && params) {
    options.data = { ...params, ...data }
    delete options.params
  }
  return {
    ...options,
    baseURL: baseURL + target,
    headers,
  }
}

const logError = (messageStr: string, data: IAnyObj) => {
  const errorContent = `Request:${JSON.stringify(data?.request)};\nResponse:${JSON.stringify(data.response)};\nErrorData:${JSON.stringify(data)}`
  message.error(
    <HoverBtn
      clipboard={errorContent}
    >
      {messageStr}
      <Button
        size="small"
        type="primary"
        onClick={() => clipboard(errorContent)}
      >
        Copy
      </Button>
    </HoverBtn>,
  )
}

export default async function <T>(options: IOption): Promise<IResult<T>> {
  const config = await getConfig(options)

  const { successCode = 200 } = config
  let loadingId: number | undefined
  try {
    if (config.loading) {
      loadingId = LoadingToast.createLoading(config.loadingText)
    }
    const res = await apiClient.request<IResult<T>>(config)
    if (config.responseType === 'blob') {
      return Promise.resolve(res as any)
    }

    if (config.missError) return Promise.resolve(res.data)

    const { code } = res.data

    if (code === successCode || code === 200) return Promise.resolve(res.data)
    throw res.data
  } catch (e: any) {
    if (config.noCatch) {
      // 保留原始错误抛给调用方自行处理
      return Promise.reject(e)
    }
    // 业务失败（HTTP 200 但 code 非成功值，见上方 throw res.data）：直接 toast 后端返回的 message
    if (e && !e.response && typeof e.code === 'number' && typeof e.message === 'string') {
      message.error(e.message)
      return Promise.reject({ ...e, msg: e.message })
    }
    console.error('Network Error: ', JSON.stringify(e), 'request:', JSON.stringify(e.request), 'response:', JSON.stringify(e.response))
    if (!e || !e?.response) {
      logError(`${e.code || e.message} - ${config.baseURL}${config.url}`, e)
      if (e && e?.msg) {
        return Promise.reject({ ...e })
      }
      return Promise.reject({ msg: `ERROR[${config.baseURL}${config.url}]`, code: 400 })
    }

    const { status, data } = e.response
    logError(`${status} - [${config.baseURL}${config.url}]`, e)

    // 说明服务器有返回
    if (e.response && e.response.data) {
      return Promise.reject(e.response.data)
    }
    // 如果 response 存在但没有 data，返回包含状态码的错误对象
    return Promise.reject({ msg: `HTTP ${status} - ${config.baseURL}${config.url}`, code: status, response: e.response })
  } finally {
    LoadingToast.destory(loadingId)
  }
}
