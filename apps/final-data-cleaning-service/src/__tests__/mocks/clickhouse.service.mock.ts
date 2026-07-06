/**
 * Mock ClickHouseService
 * 
 * 模拟 ClickHouse 的读写操作，将数据存储在内存中，
 * 用于单元测试和集成测试。
 */

export interface MockClickHouseData {
  event_log: any[]
  final_event_log: any[]
  event_attribution: any[]
  [table: string]: any[]
}

export class MockClickHouseService {
  public data: MockClickHouseData = {
    event_log: [],
    final_event_log: [],
    event_attribution: [],
  }

  public queryLog: Array<{ sql: string; params: any }> = []
  public insertLog: Array<{ table: string; data: any[] }> = []

  async query<T = any>(sql: string, params?: Record<string, any>): Promise<T[]> {
    this.queryLog.push({ sql, params })

    // 模拟查询 event_log 表
    if (sql.includes('event_log') && !sql.includes('final_event_log')) {
      const { queryDate, sessionId } = params || {}
      return this.data.event_log.filter((row) => {
        // $service_time 是 Date 对象，需要转换为字符串比较
        const serviceTimeStr = row.$service_time instanceof Date
          ? row.$service_time.toISOString()
          : String(row.$service_time)
        const matchDate = !queryDate || serviceTimeStr.startsWith(queryDate)
        const matchSession = !sessionId || row.$session_id === sessionId
        return matchDate && matchSession
      }) as T[]
    }

    return [] as T[]
  }

  async insert<T>(table: string, data: T[]): Promise<any> {
    this.insertLog.push({ table, data })
    if (!this.data[table]) {
      this.data[table] = []
    }
    this.data[table].push(...data)
    return { executed: true, summary: { written_rows: data.length } }
  }

  async executeDDL(query: string): Promise<any> {
    return { executed: true }
  }

  async close(): Promise<void> {
    // no-op
  }

  // 测试辅助方法

  /**
   * 向 event_log 表注入测试数据
   */
  seedEventLog(events: any[]) {
    this.data.event_log.push(...events)
  }

  /**
   * 清空所有数据和日志
   */
  reset() {
    this.data = {
      event_log: [],
      final_event_log: [],
      event_attribution: [],
    }
    this.queryLog = []
    this.insertLog = []
  }

  /**
   * 获取指定表的数据
   */
  getTableData<T = any>(table: string): T[] {
    return (this.data[table] || []) as T[]
  }
}
