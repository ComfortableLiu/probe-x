import request from "@/lib/request"
import { IQueryEventListSimpleRes } from "@probe-x/shared-types/src"

/**
 * 获取公参
 */
export function queryEventList() {
  return request<IQueryEventListSimpleRes>({
    url: '/event/list/simple',
    method: 'get',
  })
}
