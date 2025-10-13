import request from "@/lib/request"
import {
  ICreateSpmNodeReq,
  ICreateSpmNodeRes,
  IQueryBusinessListRes,
  IQueryTrackingSpmListReq,
  IQueryTrackingSpmListRes,
  IUpdateSpmNodeReq,
  IUpdateSpmNodeRes,
} from "@probe-x/shared-types/src"

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

export function createSpmNode(data: ICreateSpmNodeReq) {
  return request<ICreateSpmNodeRes>({
    url: '/tracking/spm/node/create',
    method: 'post',
    data,
  })
}

export function updateSpmNode(data: IUpdateSpmNodeReq) {
  return request<IUpdateSpmNodeRes>({
    url: '/tracking/spm/node/update',
    method: 'post',
    data,
  })
}
