import request from "@/lib/request"
import { IQueryBusinessListRes, IQueryTrackingSpmListReq, IQueryTrackingSpmListRes } from "@probe-x/shared-types/src"

export function querySpmNodeList(params: IQueryTrackingSpmListReq) {
  return request<IQueryTrackingSpmListRes>({
    url: '/tracking/spm/list',
    method: 'get',
    params,
  })
}

export function queryBusinessList() {
  return request<IQueryBusinessListRes>({
    url: '/tracking/spm/business/list',
    method: 'get',
  })
}
