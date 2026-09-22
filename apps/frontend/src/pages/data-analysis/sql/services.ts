import { ISqlQueryReq, ISqlQueryRes } from "@probe-x/shared-types/src"
import request from "@/lib/request"

// 执行 SQL 查询
export async function querySql(data: ISqlQueryReq) {
  return request<ISqlQueryRes>({
    url: '/data-analysis/sql/query',
    method: 'post',
    data,
    timeout: 60000,
  })
}
