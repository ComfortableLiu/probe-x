import request from "@/lib/request"
import { IFreeAnalysisReq, IFreeAnalysisRes } from "@probe-x/shared-types/src"

// 提交自由分析查询
export function submitFreeQueryTask(data: IFreeAnalysisReq) {
  return request<IFreeAnalysisRes>({
    url: '/data-analysis/free/query',
    method: 'post',
    data,
  })
}
