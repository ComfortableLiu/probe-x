import { IUserPathAnalysisReq, IUserPathAnalysisRes } from "@probe-x/shared-types/src"
import request from "@/lib/request"

// 提交数据查询
export async function submitQueryTask(data: IUserPathAnalysisReq) {
  return request<IUserPathAnalysisRes>({
    url: '/data-analysis/user-path/query',
    method: 'post',
    data,
  })
}
