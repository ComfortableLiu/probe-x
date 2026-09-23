// SQL 查询分析请求入参
export interface ISqlQueryReq {
  // SQL 语句（仅允许单条 SELECT / WITH 查询）
  sql: string
}

// SQL 查询结果列信息
export interface ISqlQueryColumn {
  // 列名
  name: string
  // ClickHouse 列类型
  type: string
}

// SQL 查询分析请求返回值
export interface ISqlQueryRes {
  // 列元数据
  columns: ISqlQueryColumn[]
  // 数据行
  rows: Record<string, any>[]
  // 返回行数
  rowCount: number
}
