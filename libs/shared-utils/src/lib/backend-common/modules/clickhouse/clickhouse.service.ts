import { Inject, Injectable } from '@nestjs/common'
import { ClickHouseClient, QueryResult } from '@clickhouse/client'
import { CLICKHOUSE_CLIENT } from "../../provider/clickhouse.provider"
import type { DataFormat } from "@clickhouse/client-common"

@Injectable()
export class ClickHouseService {
  // 注入 ClickHouse 客户端
  constructor(
    @Inject(CLICKHOUSE_CLIENT)
    private readonly clickhouseClient: ClickHouseClient,
  ) {}

  /**
   * 执行查询（返回 JSON 格式结果）
   * @param query SQL 查询语句
   * @param params 查询参数（可选）
   */
  async query<T extends DataFormat>(query: string, params?: Record<string, any>) {
    const result: QueryResult<T> = await this.clickhouseClient.query({
      query,
      params,
      format: 'JSONEachRow', // 返回每行作为 JSON 对象
    })
    return result.json()
  }

  /**
   * 批量插入数据
   * @param table 表名
   * @param data 要插入的数据数组
   */
  async insert<T>(table: string, data: T[]): Promise<void> {
    if (data.length === 0) return

    await this.clickhouseClient.insert({
      table,
      values: data,
      format: 'JSONEachRow', // 数据格式
    })
  }

  /**
   * 执行 DDL 语句（建表、删表等）
   * @param query DDL 语句
   */
  async executeDDL(query: string): Promise<void> {
    await this.clickhouseClient.command({ query })
  }

  /**
   * 关闭客户端连接（应用退出时调用）
   */
  async close(): Promise<void> {
    await this.clickhouseClient.close()
  }
}
