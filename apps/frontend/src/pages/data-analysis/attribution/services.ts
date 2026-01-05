import { IAttributionAnalysisReq, IAttributionAnalysisRes, IQueryDownloadTaskReq, IQueryDownloadTaskRes, ISubmitDownloadTaskReq, ISubmitDownloadTaskRes } from "@probe-x/shared-types/src"
import request from "@/lib/request"

// 提交数据查询
export async function submitQueryTask(data: IAttributionAnalysisReq) {
  return request<IAttributionAnalysisRes>({
    url: '/data-analysis/attribution/query',
    method: 'post',
    data,
  })
}

// 提交下载数据任务
export function submitDownloadTask(data: ISubmitDownloadTaskReq) {
  return request<ISubmitDownloadTaskRes>({
    url: '/data-analysis/attribution/download',
    method: 'post',
    data,
  })
}

// 查询下载任务情况
export function queryDownloadTask(data: IQueryDownloadTaskReq) {
  return request<IQueryDownloadTaskRes>({
    url: '/data-analysis/attribution/download/task',
    method: 'post',
    data,
  })
}
