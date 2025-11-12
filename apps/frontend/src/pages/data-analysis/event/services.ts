import request from "@/lib/request"
import {
  IEventAnalysisReq,
  IQueryDownloadTaskReq,
  IQueryDownloadTaskRes,
  ISubmitDownloadTaskReq,
  ISubmitDownloadTaskRes,
} from "@probe-x/shared-types/src"

// 提交数据查询
export function submitQueryTask(data: IEventAnalysisReq) {
  return request<IEventAnalysisReq>({
    url: '/data-analysis/event/query',
    method: 'post',
    data,
  })
}

// 提交下载数据任务
export function submitDownloadTask(data: ISubmitDownloadTaskReq) {
  return request<ISubmitDownloadTaskRes>({
    url: '/data-analysis/event/download',
    method: 'post',
    data,
  })
}

// 查询下载任务情况
export function queryDownloadTask(params: IQueryDownloadTaskReq) {
  return request<IQueryDownloadTaskRes>({
    url: '/data-analysis/event/download/task',
    method: 'get',
    params,
  })
}
