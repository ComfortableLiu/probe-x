import request from "@/lib/request"
import { IQueryEventListReq, IQueryEventListRes } from "@probe-x/shared-types/src"

export function queryEventList(params: IQueryEventListReq) {
  return request<IQueryEventListRes>({
    url: '/event/list',
    method: 'get',
    params,
  })
}
