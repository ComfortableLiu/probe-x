import request from "@/lib/request"
import {
  IQueryDataSourceListReq,
  IQueryDataSourceListRes,
  ICreateDataSourceReq,
  IUpdateDataSourceReq,
  ITestDataSourceConnectionRes,
} from "./type"

export function queryDataSourceList(params: IQueryDataSourceListReq) {
  return request<IQueryDataSourceListRes>({
    url: '/datasource/list',
    method: 'get',
    params,
  })
}

export function createDataSource(data: ICreateDataSourceReq) {
  return request({
    url: '/datasource/create',
    method: 'post',
    data,
  })
}

export function updateDataSource(data: IUpdateDataSourceReq) {
  return request({
    url: '/datasource/update',
    method: 'post',
    data,
  })
}

export function deleteDataSource(id: number) {
  return request({
    url: '/datasource/delete',
    method: 'post',
    data: { id },
  })
}

export function testDataSourceConnection(id: number) {
  return request<ITestDataSourceConnectionRes>({
    url: '/datasource/test-connection',
    method: 'post',
    data: { id },
  })
}
