import request from "@/lib/request"
import { IQueryCommonPropertyListRes } from "@probe-x/shared-types/src"

/**
 * 获取公参
 */
export function queryCommonProperties() {
  return request<IQueryCommonPropertyListRes>({
    url: '/property/commonList',
    method: 'get',
  })
}
