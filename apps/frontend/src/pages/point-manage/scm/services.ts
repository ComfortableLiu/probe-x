import request from "@/lib/request"
import {
  ICreateSpmNodeReq,
  ICreateSpmNodeRes,
  IQueryTrackingSpmListReq,
  IQueryTrackingSpmListRes,
  IUpdateSpmNodeReq,
  IUpdateSpmNodeRes,
} from "@probe-x/shared-types/src"

export function queryScmNodeList(params: IQueryTrackingSpmListReq) {
  return request<IQueryTrackingSpmListRes>({
    url: '/tracking/scm/list',
    method: 'get',
    params,
  })
}

export function createScmNode(data: ICreateSpmNodeReq) {
  return request<ICreateSpmNodeRes>({
    url: '/tracking/scm/node/create',
    method: 'post',
    data,
  })
}

export function updateScmNode(data: IUpdateSpmNodeReq) {
  return request<IUpdateSpmNodeRes>({
    url: '/tracking/scm/node/update',
    method: 'post',
    data,
  })
}
