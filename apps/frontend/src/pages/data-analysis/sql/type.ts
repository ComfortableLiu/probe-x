import { ISqlQueryRes } from "@probe-x/shared-types/src"

export interface IDataAnalysisSqlState {
  // 编辑器中的 SQL 文本
  sql?: string
  // 查询出的数据
  data?: ISqlQueryRes
  // 数据更新时间
  updateTime?: Date
  // 本次查询耗时（毫秒）
  duration?: number
  // 本次查询的错误信息
  error?: string
}
