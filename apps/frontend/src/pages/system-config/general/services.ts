import request from "@/lib/request"
import { IGeneralConfig, ICleanNowReq, ICleanNowRes } from '@probe-x/shared-types/src'

export function getGeneralConfig() {
  return request<IGeneralConfig>({
    url: '/system-config/general',
    method: 'get',
  })
}

export function updateGeneralConfig(data: IGeneralConfig) {
  return request<IGeneralConfig>({
    url: '/system-config/general',
    method: 'put',
    data,
  })
}

export function cleanNow(data: ICleanNowReq) {
  return request<ICleanNowRes>({
    url: '/system-config/general/clean-now',
    method: 'post',
    data,
  })
}
