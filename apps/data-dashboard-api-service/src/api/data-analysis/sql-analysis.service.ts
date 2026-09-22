import { Injectable } from '@nestjs/common'
import { ISqlQueryReq, ISqlQueryRes } from "@probe-x/shared-types/src"
import { BusinessException, ClickHouseService } from "@probe-x/shared-utils/src/lib/backend-common"

// 写操作 / DDL 关键字（按词边界匹配）
const FORBIDDEN_KEYWORDS = [
  'INSERT',
  'ALTER',
  'DROP',
  'TRUNCATE',
  'RENAME',
  'SYSTEM',
  'GRANT',
  'CREATE',
  'ATTACH',
  'DETACH',
  'OPTIMIZE',
  'KILL',
  'SET',
  'DELETE',
  'UPDATE',
  'REPLACE',
]

@Injectable()
export class SqlAnalysisService {
  constructor(
    private readonly clickhouseService: ClickHouseService,
  ) {
  }

  /**
   * 校验并规范化 SQL：仅允许单条 SELECT / WITH 查询，无 LIMIT 时追加 LIMIT 1000
   * @param sql 原始 SQL 语句
   */
  validateAndNormalizeSql(sql: string): string {
    if (!sql || sql.trim() === '') {
      throw new BusinessException('SQL 语句不能为空')
    }

    // 去除注释（--、# 单行注释，/* */ 块注释）与首尾空白
    const cleaned = sql
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/--[^\n]*/g, ' ')
      .replace(/#[^\n]*/g, ' ')
      .trim()

    if (cleaned === '') {
      throw new BusinessException('SQL 语句不能为空')
    }

    // 必须以 SELECT 或 WITH 开头
    if (!/^(SELECT|WITH)\b/i.test(cleaned)) {
      throw new BusinessException('仅支持 SELECT / WITH 开头的查询语句')
    }

    // 拒绝分号（多语句）
    if (cleaned.includes(';')) {
      throw new BusinessException('不允许包含多条语句（分号）')
    }

    // 拒绝写操作关键字（按词边界匹配，SYSTEM 后紧跟 . 时为 system 数据库前缀，允许只读访问）
    const forbiddenPattern = new RegExp(`\\b(${FORBIDDEN_KEYWORDS.map(keyword => keyword === 'SYSTEM' ? 'SYSTEM(?!\\s*\\.)' : keyword).join('|')})\\b`, 'i')
    const forbiddenMatch = cleaned.match(forbiddenPattern)
    if (forbiddenMatch) {
      throw new BusinessException(`不允许使用关键字：${forbiddenMatch[1].toUpperCase()}，仅支持只读查询`)
    }

    // 拒绝 INTO OUTFILE（ClickHouse 服务端写文件）
    if (/\bINTO\s+OUTFILE\b/i.test(cleaned)) {
      throw new BusinessException('不允许使用 INTO OUTFILE，仅支持只读查询')
    }

    // 无 LIMIT 时追加 LIMIT 1000
    if (!/\bLIMIT\b/i.test(cleaned)) {
      return `${cleaned} LIMIT 1000`
    }

    return cleaned
  }

  /**
   * 执行 SQL 查询，返回列元数据与数据行
   * @param data SQL 查询请求
   */
  async executeQuery(data: ISqlQueryReq): Promise<ISqlQueryRes> {
    const sql = this.validateAndNormalizeSql(data.sql)

    try {
      const { meta, data: rows } = await this.clickhouseService.queryWithMeta<Record<string, any>>(sql, {
        max_execution_time: 30,
      })
      return {
        columns: meta.map(item => ({
          name: item.name,
          type: item.type,
        })),
        rows,
        rowCount: rows.length,
      }
    } catch (e) {
      throw new BusinessException(`SQL 查询失败：${e instanceof Error ? e.message : '未知错误'}`)
    }
  }
}
