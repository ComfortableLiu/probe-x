import { IFunnelAnalysisReq } from "@probe-x/shared-types/src"
import { ISqlGenerateResult } from "@src/api/data-analysis/type"


/**
 * 工具函数：生成ClickHouse查询SQL（添加维度排序，适配表格合并）
 */
export function generateEventAnalysisSql(params: IFunnelAnalysisReq): ISqlGenerateResult {
  return {
    sql: '',
    params: {},
  }
}
