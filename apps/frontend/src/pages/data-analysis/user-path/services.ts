import { IQueryDownloadTaskReq, IQueryDownloadTaskRes, ISubmitDownloadTaskReq, ISubmitDownloadTaskRes, IUserPathAnalysisReq, IUserPathAnalysisRes } from "@probe-x/shared-types/src"
import request from "@/lib/request"

// 提交数据查询
export async function submitQueryTask(data: IUserPathAnalysisReq) {
  return request<IUserPathAnalysisRes>({
    url: '/data-analysis/user-path/query',
    method: 'post',
    data,
  })
}

// 提交下载数据任务
export function submitDownloadTask(data: ISubmitDownloadTaskReq) {
  return request<ISubmitDownloadTaskRes>({
    url: '/data-analysis/user-path/download',
    method: 'post',
    data,
  })
}

// 查询下载任务情况
export function queryDownloadTask(data: IQueryDownloadTaskReq) {
  return request<IQueryDownloadTaskRes>({
    url: '/data-analysis/user-path/download/task',
    method: 'post',
    data,
  })
}
