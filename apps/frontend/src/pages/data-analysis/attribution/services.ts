import { IAttributionAnalysisReq, IAttributionAnalysisRes } from "@probe-x/shared-types/src"
import request from "@/lib/request"

// 提交数据查询
export async function submitQueryTask(data: IAttributionAnalysisReq) {
  return request<IAttributionAnalysisRes>({
    url: '/data-analysis/attribution/query',
    method: 'post',
    data,
  })
}
