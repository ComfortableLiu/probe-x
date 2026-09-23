import request from "@/lib/request"
import {
  IUtmAnalysisReq,
  IUtmAnalysisRes,
  IQueryDownloadTaskReq,
  IQueryDownloadTaskRes,
  IQueryUtmOptionsRes,
  ISubmitDownloadTaskRes,
} from "@probe-x/shared-types/src"

// 提交数据查询
export function submitQueryTask(data: IUtmAnalysisReq) {
  return request<IUtmAnalysisRes>({
    url: "/data-analysis/utm/query",
    method: "post",
    data,
  })
}

// 提交下载数据任务
export function submitDownloadTask(data: IUtmAnalysisReq) {
  return request<ISubmitDownloadTaskRes>({
    url: "/data-analysis/utm/download",
    method: "post",
    data,
  })
}

// 查询下载任务情况
export function queryDownloadTask(data: IQueryDownloadTaskReq) {
  return request<IQueryDownloadTaskRes>({
    url: "/data-analysis/utm/download/task",
    method: "post",
    data,
  })
}

// 查询 UTM 取值选项（取值筛选器下拉与别名展示用）
export function queryUtmOptions() {
  return request<IQueryUtmOptionsRes>({
    url: "/utm/options",
    method: "get",
  })
}
