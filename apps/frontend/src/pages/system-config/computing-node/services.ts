import request from "@/lib/request"
import {
  IQueryComputeNodeListReq,
  IQueryComputeNodeListRes,
  ICreateComputeNodeReq,
  IUpdateComputeNodeReq,
} from "./type"

export function queryComputeNodeList(params: IQueryComputeNodeListReq) {
  return request<IQueryComputeNodeListRes>({
    url: '/compute-node/list',
    method: 'get',
    params,
  })
}

export function createComputeNode(data: ICreateComputeNodeReq) {
  return request({
    url: '/compute-node/create',
    method: 'post',
    data,
  })
}

export function updateComputeNode(data: IUpdateComputeNodeReq) {
  return request({
    url: '/compute-node/update',
    method: 'post',
    data,
  })
}

export function deleteComputeNode(id: number) {
  return request({
    url: '/compute-node/delete',
    method: 'post',
    data: { id },
  })
}
