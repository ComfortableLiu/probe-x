import React from 'react'
import axios from 'axios'
import { IOption, IResult } from './type'
// import env from '@/patch/env'
import cancelToken from "@/lib/request/cancelToken"
import whiteList from "@/lib/request/whiteList"
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
  // 取消请求
  const cancel = axios.CancelToken
  const source = cancel.source()

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
  if (!whiteList.includes(options.url)) {
    options.cancelToken = source.token
    cancelToken.add(source)
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

  const { successCode = 'SUCCESS' } = config
  try {
    if (config.loading) {
      LoadingToast.createLoading(config.loadingText)
    }
    const res = await apiClient.request<IResult<T>>(config)
    LoadingToast.destory()
    if (config.responseType === 'blob') {
      return Promise.resolve(res as any)
    }

    if (config.missError) return Promise.resolve(res.data)

    const { code } = res.data

    if (code === successCode || code === 200) return Promise.resolve(res.data)
    throw res.data
  } catch (e: any) {
    if (config.noCatch) {
      return Promise.reject({ noMessage: true })
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

    if (status === 401) {
      return Promise.reject({ msg: '登录超时', code: 401 })
    }
    if (status === 400 && data) {
      if (data.msg && data.msg === 'Expect authentication ') {
        return Promise.reject({ msg: '登录超时', code: 400 })
      }
    }
    if (status === 500 && data && data.msg.includes('Token is null')) {
      return Promise.reject({ msg: '登录超时', code: 500 })
    }
    // 说明服务器有返回
    if (e.response && e.response.data) {
      return Promise.reject(e.response.data)
    }
    return Promise.reject(e)
  } finally {
    LoadingToast.destory()
  }
}
