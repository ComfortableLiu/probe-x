import request from "@/lib/request"
import {
  IUtmAnalysisReq,
  IUtmAnalysisRes,
  IQueryDownloadTaskReq,
  IQueryDownloadTaskRes,
  IQueryUtmOptionsReq,
  IQueryUtmOptionsRes,
  IResolveUtmOptionsReq,
  IResolveUtmOptionsRes,
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

// 分页查询 UTM 取值选项（取值筛选器下拉用：联网分页 + keyword 模糊匹配 value/alias）
export function queryUtmOptions(params: IQueryUtmOptionsReq) {
  return request<IQueryUtmOptionsRes>({
    url: "/utm/options",
    method: "get",
    params,
  })
}

// 批量精确解析 UTM 取值（URL 回显的选中值、查询结果行里的值，按需补别名用）
export function resolveUtmOptions(data: IResolveUtmOptionsReq) {
  return request<IResolveUtmOptionsRes>({
    url: "/utm/options/resolve",
    method: "post",
    data,
  })
}
