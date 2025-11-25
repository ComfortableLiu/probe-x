import { IFunnelAnalysisReq, IFunnelAnalysisRes } from "@probe-x/shared-types/src"
import request from "@/lib/request"

// 提交数据查询
export async function submitQueryTask(data: IFunnelAnalysisReq) {
  return request<IFunnelAnalysisRes>({
    url: '/data-analysis/funnel/query',
    method: 'post',
    data,
  })
}
