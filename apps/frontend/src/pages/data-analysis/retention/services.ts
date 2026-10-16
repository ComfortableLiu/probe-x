import { IQueryDownloadTaskReq, IQueryDownloadTaskRes, IRetentionAnalysisReq, IRetentionAnalysisRes, ISubmitDownloadTaskRes } from "@probe-x/shared-types/src"
import request from "@/lib/request"

// 提交数据查询
export async function submitQueryTask(data: IRetentionAnalysisReq) {
  return request<IRetentionAnalysisRes>({
    url: '/data-analysis/retention/query',
    method: 'post',
    data,
  })
}

// 提交下载数据任务
export function submitDownloadTask(data: IRetentionAnalysisReq) {
  return request<ISubmitDownloadTaskRes>({
    url: '/data-analysis/retention/download',
    method: 'post',
    data,
  })
}

// 查询下载任务情况
export function queryDownloadTask(data: IQueryDownloadTaskReq) {
  return request<IQueryDownloadTaskRes>({
    url: '/data-analysis/retention/download/task',
    method: 'post',
    data,
  })
}
