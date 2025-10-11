import request from "@/lib/request"
import {
  ICreateBusinessSiteReq,
  ICreateBusinessSiteRes,
  IQueryBusinessListRes,
  IUpdateBusinessSiteReq,
  IUpdateBusinessSiteRes,
} from "@probe-x/shared-types/src"

export function queryBusinessList() {
  return request<IQueryBusinessListRes>({
    url: '/tracking/spm/business/list',
    method: 'get',
  })
}

/**
 * 新建业务线/站点
 */
export function createBusinessSite(data: ICreateBusinessSiteReq) {
  return request<ICreateBusinessSiteRes>({
    url: '/tracking/spm/business/create',
    method: 'post',
    data,
  })
}

/**
 * 编辑业务线/站点
 */
export function updateBusinessSite(data: IUpdateBusinessSiteReq) {
  return request<IUpdateBusinessSiteRes>({
    url: '/tracking/spm/business/update',
    method: 'post',
    data,
  })
}