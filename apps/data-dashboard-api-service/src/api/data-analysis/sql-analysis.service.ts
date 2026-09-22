import { Injectable } from '@nestjs/common'
import { ISqlQueryReq, ISqlQueryRes } from "@probe-x/shared-types/src"
import { BusinessException, ClickHouseService } from "@probe-x/shared-utils/src/lib/backend-common"

// 写操作 / DDL 关键字（按词边界匹配，只看去掉字面量与注释后的代码部分）
const FORBIDDEN_KEYWORDS = [
  'INSERT',
  'ALTER',
  'DROP',
  'TRUNCATE',
  'RENAME',
  'SYSTEM',
  'GRANT',
  'REVOKE',
  'CREATE',
  'ATTACH',
  'DETACH',
  'OPTIMIZE',
  'KILL',
  'SET',
  'DELETE',
  'UPDATE',
  'REPLACE',
  'BACKUP',
  'RESTORE',
  'EXCHANGE',
  'UNDROP',
  'VACUUM',
]

// 只读约束不能在查询里被改掉，否则等于让客户端自己解除服务端的只读限制
const FORBIDDEN_SETTINGS = ['readonly', 'allow_ddl', 'constraints']

interface IMaskedSql {
  /** 字面量与注释替换成等长空白后的文本，下标与原文一一对应 */
  code: string
  /** 最后一段有效代码（不含注释与空白）的结束下标，用于追加 LIMIT */
  endOfCode: number
}

/**
 * 把字符串字面量、带引号的标识符与注释替换成等长空白。
 *
 * 关键字 / 分号 / LIMIT 的判定只看代码部分，这样：
 * - 不会因为 `WHERE title LIKE '%update%'`、`WHERE s = 'a; b'` 这类字面量而误判成写操作
 * - 原文一字不改地交给 ClickHouse，注释里写 `--` `#` `/*` 不会破坏查询
 * - 等长替换让 code 上的下标可以直接用回原文（追加 LIMIT 时要用）
 *
 * 注意：这里只是为了让下面的判定尽量准确。真正的只读边界是 ClickHouse 的 readonly 设置，
 * 引号配对在极端构造下总能找到与解析器不一致的写法，靠正则挡写操作不可靠。
 */
function maskSqlLiterals(sql: string): IMaskedSql {
  const n = sql.length
  const out = new Array<string>(n)
  let endOfCode = 0
  let i = 0

  // 把 [start, end) 打成空白；keepAsCode 为真时视作有效代码（字面量属于代码，注释不算）
  const blank = (start: number, end: number, keepAsCode: boolean) => {
    const stop = Math.min(end, n)
    for (let k = start; k < stop; k++) {
      out[k] = sql[k] === '\n' ? '\n' : ' '
    }
    if (keepAsCode) {
      endOfCode = stop
    }
    i = stop
  }

  while (i < n) {
    const ch = sql[i]
    const next = sql[i + 1]

    // -- 行注释 / # 行注释
    if ((ch === '-' && next === '-') || ch === '#') {
      let j = i
      while (j < n && sql[j] !== '\n') j++
      blank(i, j, false)
      continue
    }

    // /* 块注释 */
    if (ch === '/' && next === '*') {
      let j = i + 2
      while (j < n && !(sql[j] === '*' && sql[j + 1] === '/')) j++
      blank(i, j + 2, false)
      continue
    }

    // '...' 字符串字面量：支持 \ 转义与 '' 转义
    if (ch === "'") {
      let j = i + 1
      while (j < n) {
        if (sql[j] === '\\') {
          j += 2
          continue
        }
        if (sql[j] === "'" && sql[j + 1] === "'") {
          j += 2
          continue
        }
        if (sql[j] === "'") {
          j += 1
          break
        }
        j += 1
      }
      blank(i, j, true)
      continue
    }

    // `..." 与 "..." 引用标识符（$ 开头的埋点列必须用反引号），成对引号是转义
    if (ch === '`' || ch === '"') {
      let j = i + 1
      while (j < n && sql[j] !== ch) j++
      while (j + 1 < n && sql[j + 1] === ch) j += 2
      blank(i, j + 1, true)
      continue
    }

    // $$...$$ / $tag$...$tag$ 定界字符串
    if (ch === '$') {
      const delimiter = /^\$(\w*)\$/.exec(sql.slice(i))
      if (delimiter) {
        const close = sql.indexOf(delimiter[0], i + delimiter[0].length)
        blank(i, close === -1 ? n : close + delimiter[0].length, true)
        continue
      }
    }

    out[i] = ch
    if (!/\s/.test(ch)) {
      endOfCode = i + 1
    }
    i++
  }

  for (let k = 0; k < n; k++) {
    if (out[k] === undefined) out[k] = ' '
  }

  return { code: out.join(''), endOfCode }
}

@Injectable()
export class SqlAnalysisService {
  constructor(
    private readonly clickhouseService: ClickHouseService,
  ) {
  }

  /**
   * 校验并规范化 SQL：仅允许单条 SELECT / WITH 查询，无 LIMIT 时追加 LIMIT 1000
   *
   * 这一层是快速失败与友好报错。真正的只读保证由 executeQuery 里的 ClickHouse readonly 设置兜底。
   * @param sql 原始 SQL 语句
   */
  validateAndNormalizeSql(sql: string): string {
    if (!sql || sql.trim() === '') {
      throw new BusinessException('SQL 语句不能为空')
    }

    // 判定看掩码后的代码部分，原文只用来做最终返回
    const trimmed = sql.trim()
    const { code, endOfCode } = maskSqlLiterals(trimmed)
    const codeOnly = code.trim()

    if (codeOnly === '') {
      throw new BusinessException('SQL 语句不能为空')
    }

    // 必须以 SELECT 或 WITH 开头
    if (!/^(SELECT|WITH)\b/i.test(codeOnly)) {
      throw new BusinessException('仅支持 SELECT / WITH 开头的查询语句')
    }

    // 拒绝分号（多语句）
    if (code.includes(';')) {
      throw new BusinessException('不允许包含多条语句（分号）')
    }

    // 拒绝写操作关键字（按词边界匹配，SYSTEM 后紧跟 . 时为 system 数据库前缀，允许只读访问）
    const forbiddenPattern = new RegExp(`\\b(${FORBIDDEN_KEYWORDS.map(keyword => keyword === 'SYSTEM' ? 'SYSTEM(?!\\s*\\.)' : keyword).join('|')})\\b`, 'i')
    const forbiddenMatch = code.match(forbiddenPattern)
    if (forbiddenMatch) {
      throw new BusinessException(`不允许使用关键字：${forbiddenMatch[1].toUpperCase()}，仅支持只读查询`)
    }

    // 拒绝 INTO OUTFILE（ClickHouse 服务端写文件）
    if (/\bINTO\s+OUTFILE\b/i.test(code)) {
      throw new BusinessException('不允许使用 INTO OUTFILE，仅支持只读查询')
    }

    // SETTINGS 子句固定在语句末尾，顺带用它的位置定位 LIMIT 的插入点
    const settingsPattern = /\bSETTINGS\s+[A-Za-z_]\w*\s*=/gi
    let settingsMatch: RegExpExecArray | null = null
    let match: RegExpExecArray | null
    while ((match = settingsPattern.exec(code)) !== null) {
      settingsMatch = match
    }

    // 改掉 readonly 等于让客户端自己解除服务端的只读约束，必须挡在前面
    if (settingsMatch && new RegExp(`\\b(${FORBIDDEN_SETTINGS.join('|')})\\b`, 'i').test(code.slice(settingsMatch.index))) {
      throw new BusinessException(`不允许在 SETTINGS 中修改 ${FORBIDDEN_SETTINGS.join(' / ')}`)
    }

    // 无 LIMIT 时自动追加 LIMIT 1000
    // 插在 SETTINGS 之前（LIMIT 在 SETTINGS 前面才是合法顺序），插在最后一段代码之后（否则会被行注释吃掉）
    if (!/\bLIMIT\s+[\d({]/i.test(code)) {
      const insertAt = settingsMatch ? settingsMatch.index : endOfCode
      const head = trimmed.slice(0, insertAt).trimEnd()
      const tail = trimmed.slice(insertAt).trimStart()
      return tail ? `${head} LIMIT 1000 ${tail}` : `${head} LIMIT 1000`
    }

    return trimmed
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
        // 只读约束的真正边界：ClickHouse 自己拒绝任何非查询语句与 DDL，与关键字黑名单无关。
        // 用 2 而不是 1，是为了让查询里的 SETTINGS 子句仍然可用，两者都禁止写入与 DDL。
        readonly: 2,
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
