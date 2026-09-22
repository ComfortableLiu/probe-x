import { Injectable } from '@nestjs/common'
import { ISqlQueryReq, ISqlQueryRes } from "@probe-x/shared-types/src"
import { BusinessException, ClickHouseService } from "@probe-x/shared-utils/src/lib/backend-common"

/**
 * 这一层是快速失败与友好报错，不是安全边界。真正的只读边界是 executeQuery 里传给
 * ClickHouse 的 readonly 设置——引号配对与转义在极端构造下总能找到与解析器不一致的写法，
 * 靠正则挡写操作不可靠。
 *
 * 但 readonly 挡不住「纯 SELECT 也能干坏事」这一类：file()、url()、remote()、mysql()、s3()、
 * executable()、eval() 在只读模式下照常执行，能读服务器上的文件、出网、跨实例查库，
 * sqlite() 甚至会在文件不存在时创建空库文件（纯 SELECT 的写副作用）。
 * 下面几组名单挡的就是这一类只读逃逸面。
 *
 * 命中规则统一三点：
 * - 一律带 i 标志，ClickHouse 函数名大小写不敏感（URL( / S3( 照样要拦）
 * - 用前缀匹配覆盖变体（s3Cluster / icebergS3Cluster / dictGetOrDefault / mergeTreeProjection…），
 *   逐个枚举名字必漏；但 url / hive / generate / version 这类前缀会撞上合法函数
 * （urlHierarchy / hiveHash / generateUUIDv4），只能精确匹配
 * - 左侧断言 (?<![A-Za-z0-9_$.`])，否则 sumMerge( / arrayMerge( 会被 merge( 误伤，
 *   埋点列名 $file 也会被 file( 误伤
 */

// 左侧断言：不允许紧跟标识符字符（含 $ 与 ` ，埋点列名以 $ 开头且要反引号包裹）
const LEFT_BOUND = '(?<![A-Za-z0-9_$.\\x60])'

// 写操作 / DDL 关键字（按词边界匹配，只看去掉字面量、注释与引用标识符后的代码部分）
const FORBIDDEN_KEYWORDS = [
  'INSERT',
  'ALTER',
  'DROP',
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
  'BACKUP',
  'RESTORE',
  'EXCHANGE',
  'UNDROP',
  'VACUUM',
  // EXPLAIN 可以当表表达式用（SELECT * FROM (EXPLAIN AST …)），而 viewExplain 的
  // settings 参数是字符串字面量，能绕开下面的设置名检查
  'EXPLAIN',
]

// REPLACE / TRUNCATE 单独拦：\bREPLACE\b 会误伤 replace(a, b, c)、\bTRUNCATE\b 会误伤
// truncate(x, n) 这两个高频标量函数，所以只认它们后面跟着语句关键字的写法
const FORBIDDEN_STATEMENTS: Array<[RegExp, string]> = [
  [/\bREPLACE\s+(INTO|PARTITION)\b/i, 'REPLACE INTO / REPLACE PARTITION'],
  [/\bTRUNCATE\s+(TABLE|DATABASE)\b/i, 'TRUNCATE TABLE / TRUNCATE DATABASE'],
]

/**
 * 只读查询里也必须拦掉的函数（表函数 + 有副作用或会越权的标量函数）。
 * 前缀命中即拦。
 */
const FORBIDDEN_CALL_PREFIXES = [
  // 出网 / 外部数据源：url() 能打到 169.254.169.254 与 8123 回环，把第二条查询藏在参数里绕开本文件；
  // mysql()/postgresql() 的第三个参数会拼进远端语句，等于在别人的库上执行 SQL；
  // remote()/cluster() 用的是 remote_servers 里配的服务端凭据，是拿服务端身份去别的实例查
  's3', 'hdfs', 'azureBlobStorage', 'gcs', 'cosn', 'oss', 'objectStorage',
  'iceberg', 'deltaLake', 'hudi', 'paimon', 'arrowFlight', 'bigQuery', 'ytsaurus',
  'prometheus', 'meilisearch', 'nats', 'rabbitmq',
  'mysql', 'postgres', 'mongo', 'redis', 'odbc', 'jdbc',
  'merge', 'cluster', 'remote', 'dictionary', 'view', 'input',
  // 本地文件与命令执行
  'file', 'filesystem', 'disk', 'sqlite', 'executable', 'eval', 'loop',
  // 字典 / 物化视图取数，读的是别的表
  'dict', 'joinGet',
  // 字符串二次解析成 SQL、权限探测
  'assignCentroid', 'fuzzQuery',
  // 拖时间，能把执行线程占满
  'sleep',
  // 服务器指纹 / 请求头泄露 / 内省
  'hostName', 'serverUUID', 'tcpPort', 'getClientHTTPHeader', 'demangle', 'addressTo',
  // 索引与投影探测
  'mergeTree',
]

/**
 * 必须精确匹配的名字：按前缀会误伤同前缀的合法函数。
 * url -> urlHierarchy、hive -> hiveHash、generate -> generateUUIDv4 / generateULID
 */
const FORBIDDEN_CALLS = [
  'url', 'urlCluster',
  'hive',
  'version',
  'generateRandom', 'generateSeries', 'generate_series',
]

const FORBIDDEN_CALL_PATTERN = new RegExp(
  LEFT_BOUND + `((?:${FORBIDDEN_CALL_PREFIXES.join('|')})[A-Za-z0-9_]*|${FORBIDDEN_CALLS.join('|')})\\s*\\(`,
  'i',
)

/**
 * system 库整体拒绝，只放行 one / numbers / zeros 这几个纯生成表。
 * 不逐个列 system 表名：ClickHouse 每个版本都在加新表（query_cache / user_query_log /
 * keeper_* …），逐个列的黑名单注定落后一版，禁掉整个库才对未来版本免疫。
 */
const SYSTEM_REF_PATTERN = new RegExp(LEFT_BOUND + 'system\\s*\\.\\s*([A-Za-z_$][A-Za-z0-9_$]*)', 'gi')
const SYSTEM_TABLE_WHITELIST = new Set(['one', 'numbers', 'numbers_mt', 'numbersmt', 'zeros', 'zeros_mt', 'zerosmt'])

/**
 * 查询里不许改的设置。
 * readonly=2 的语义是「除 readonly 外所有设置查询可改」，所以不能只盯 readonly 自己：
 * 下面这些会让只读查询打开出网 / 凭据 / 泄密 / 二次解析的口子，
 * max_execution_time 则是因为执行时长由我们固定成 30 秒，查询里改成 0 就能占死执行线程。
 * 真正的硬约束要在 ClickHouse profile 的 <constraints> 里把这些设置逐个 <readonly/> 钉死。
 */
const FORBIDDEN_SETTINGS = [
  // 解除只读与约束
  'readonly', 'allow_ddl', 'constraints', 'changeable_in_readonly',
  // 出网与凭据
  's3_allow_server_credentials_in_user_queries', 'use_environment_credentials',
  'dynamic_disk_allow_from_env', 'dynamic_disk_allow_from_zk', 'dynamic_disk_allow_include',
  'allow_unrestricted_reads_from_keeper', 'http_response_headers',
  // 泄密
  'allow_get_client_http_header', 'allow_introspection_functions',
  'format_display_secrets_in_show_and_select', 'query_cache_share_between_users',
  'send_logs_level', 'send_logs_source_regexp',
  // 换一套解析语义，等于换方言绕开上面的判定
  'compatibility',
  // 纯 SELECT 也会落盘的写副作用（JIT 编译产物）
  'compile_expressions',
  'max_execution_time',
]
const FORBIDDEN_SETTING_PREFIXES = ['allow_experimental', 'allow_unrestricted']

const SETTING_REF_PATTERN = /(?<![A-Za-z0-9_$.])([A-Za-z_][A-Za-z0-9_]*)\s*=/g

function isForbiddenSetting(name: string): boolean {
  const lower = name.toLowerCase()
  return FORBIDDEN_SETTINGS.includes(lower)
    || FORBIDDEN_SETTING_PREFIXES.some(prefix => lower.startsWith(prefix))
}

interface IMaskedSql {
  /** 字面量、注释、引用标识符都替换成等长空白，用于关键字 / 分号 / LIMIT 判定 */
  code: string
  /** 同 code，但引用标识符保留内容（只抹掉引号），用于表名 / 函数名判定 */
  refs: string
  /** 字符串字面量的内容，表名与设置名会被当作参数传进表函数，要单独再扫一遍 */
  literals: string[]
  /** 最后一段有效代码（不含注释与空白）的结束下标，用于追加 LIMIT */
  endOfCode: number
}

/**
 * 把字符串字面量、带引号的标识符与注释替换成等长空白。
 *
 * 判定只看代码部分，这样：
 * - 不会因为 `WHERE title LIKE '%update%'`、`WHERE s = 'a; b'` 这类字面量而误判成写操作
 * - 原文一字不改地交给 ClickHouse，注释里写 `--` `#` `/*` 不会破坏查询
 * - 等长替换让 code 上的下标可以直接用回原文（追加 LIMIT 时要用）
 *
 * 引用标识符在 code 里被抹掉、在 refs 里保留内容：标识符是结构不是数据，
 * 抹掉会让 `system`.`query_log` 这种写法躲过所有表名规则。但关键字判定仍看 code，
 * 免得 `$update`、`$delete` 这类反引号包裹的埋点列名撞上写关键字。
 *
 * 注意：这里只是为了让下面的判定尽量准确。真正的只读边界是 ClickHouse 的 readonly 设置。
 */
function maskSqlLiterals(sql: string): IMaskedSql {
  const n = sql.length
  const codeArr = new Array<string>(n)
  const refArr = new Array<string>(n)
  const literals: string[] = []
  let endOfCode = 0
  let i = 0

  // 把 [start, end) 打成空白；ident 为真时 refs 保留区间内容（只抹首尾的引号）
  const blank = (start: number, end: number, options: { ident?: boolean; asCode?: boolean }) => {
    const stop = Math.min(end, n)
    for (let k = start; k < stop; k++) {
      codeArr[k] = ' '
      const isEdge = options.ident && (k === start || k === stop - 1)
      refArr[k] = options.ident && !isEdge ? sql[k] : ' '
    }
    if (options.asCode) {
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
      blank(i, j, {})
      continue
    }

    // /* 块注释 */
    if (ch === '/' && next === '*') {
      let j = i + 2
      while (j < n && !(sql[j] === '*' && sql[j + 1] === '/')) j++
      if (j >= n) {
        throw new BusinessException('SQL 语句中存在未闭合的注释')
      }
      blank(i, j + 2, {})
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
      if (j > n || sql[j - 1] !== "'") {
        throw new BusinessException('SQL 语句中存在未闭合的字符串')
      }
      literals.push(sql.slice(i + 1, j - 1))
      blank(i, j, { asCode: true })
      continue
    }

    // `..." 与 "..." 引用标识符（$ 开头的埋点列必须用反引号），成对引号是转义
    if (ch === '`' || ch === '"') {
      let j = i + 1
      while (j < n) {
        if (sql[j] === ch) {
          if (sql[j + 1] === ch) {
            j += 2
            continue
          }
          j += 1
          break
        }
        j += 1
      }
      if (j > n || sql[j - 1] !== ch) {
        throw new BusinessException('SQL 语句中存在未闭合的引用标识符')
      }
      blank(i, j, { ident: true, asCode: true })
      continue
    }

    // $$...$$ / $tag$...$tag$ 定界字符串
    if (ch === '$') {
      const delimiter = /^\$(\w*)\$/.exec(sql.slice(i))
      if (delimiter) {
        const close = sql.indexOf(delimiter[0], i + delimiter[0].length)
        if (close === -1) {
          throw new BusinessException('SQL 语句中存在未闭合的字符串')
        }
        literals.push(sql.slice(i + delimiter[0].length, close))
        blank(i, close + delimiter[0].length, { asCode: true })
        continue
      }
    }

    codeArr[i] = ch
    refArr[i] = ch
    if (!/\s/.test(ch)) {
      endOfCode = i + 1
    }
    i++
  }

  for (let k = 0; k < n; k++) {
    if (codeArr[k] === undefined) codeArr[k] = ' '
    if (refArr[k] === undefined) refArr[k] = ' '
  }

  return { code: codeArr.join(''), refs: refArr.join(''), literals, endOfCode }
}

const isWordChar = (ch: string | undefined) => ch !== undefined && /[A-Za-z0-9_$]/.test(ch)
const isLetter = (ch: string | undefined) => ch !== undefined && /[A-Za-z_]/.test(ch)

function readWord(code: string, start: number): number {
  let end = start
  while (isWordChar(code[end])) end++
  return end
}

const isWordStart = (code: string, index: number) => isLetter(code[index]) && !isWordChar(code[index - 1])

// 集合运算：ClickHouse 的 LIMIT / ORDER BY 跟着各个分支走，行数上限要作用在整体上
const SET_OPERATION_WORDS = new Set(['UNION', 'INTERSECT', 'EXCEPT'])

interface ICodeScan {
  /** 顶层（括号深度 0）是否已有 LIMIT */
  topLevelLimit: boolean
  /** 顶层是否是集合运算（UNION / INTERSECT / EXCEPT），这类要把整体包一层再限行数 */
  topLevelSetOp: boolean
  /** 顶层 LIMIT 子句里写到的最大行数（LIMIT n / LIMIT offset, n / LIMIT n OFFSET m 里取最大），没写或解析不出时为 null */
  maxTopLevelLimit: number | null
  /** 顶层 SETTINGS 子句的起始下标，LIMIT 要插在它前面 */
  settingsInsertAt: number | null
  /** 所有 SETTINGS 子句（含嵌套）里出现的设置名 */
  settingNames: string[]
}

/**
 * 扫一遍代码部分，取出顶层 LIMIT / 集合运算 / SETTINGS 的位置与全部设置名。
 *
 * 必须区分括号深度：`WHERE 1 IN (SELECT 1 LIMIT 1)` 里的 LIMIT 是子查询的，
 * 不能拿它当「已经限过行了」，否则整条查询的结果集与扫描量就没上限了。
 */
function scanCode(code: string): ICodeScan {
  const settingNames: string[] = []
  let topLevelLimit = false
  let topLevelSetOp = false
  let maxTopLevelLimit: number | null = null
  let settingsInsertAt: number | null = null
  let depth = 0

  for (let i = 0; i < code.length; i++) {
    const ch = code[i]
    if (ch === '(') {
      depth++
      continue
    }
    if (ch === ')') {
      depth--
      continue
    }
    if (!isWordStart(code, i)) continue

    const wordStart = i
    const end = readWord(code, i)
    const word = code.slice(i, end).toUpperCase()
    i = end - 1

    if (depth === 0 && word === 'LIMIT') {
      topLevelLimit = true
      // 三种写法里的行数都算上：LIMIT n / LIMIT offset, n / LIMIT n OFFSET m
      // （offset 与 count 谁是第二个数各版本说法不一，取最大值才不会把上限算小）
      const countMatch = /^\s*(\d+)(?:\s*,\s*(\d+))?(?:\s+OFFSET\s+(\d+))?/i.exec(code.slice(end))
      for (let group = 1; group <= 3; group++) {
        const value = countMatch?.[group]
        if (value === undefined) continue
        maxTopLevelLimit = Math.max(maxTopLevelLimit ?? 0, Number(value))
      }
      continue
    }
    if (depth === 0 && SET_OPERATION_WORDS.has(word)) {
      topLevelSetOp = true
      continue
    }
    if (word !== 'SETTINGS') continue

    if (depth === 0 && settingsInsertAt === null) {
      settingsInsertAt = wordStart
    }
    // SETTINGS 子句里的设置名：在同一个括号深度内取全部 name =
    let inner = end
    let innerDepth = depth
    while (inner < code.length) {
      const innerCh = code[inner]
      if (innerCh === '(') {
        innerDepth++
        inner++
        continue
      }
      if (innerCh === ')') {
        innerDepth--
        if (innerDepth < depth) break
        inner++
        continue
      }
      if (!isWordStart(code, inner)) {
        inner++
        continue
      }
      const innerEnd = readWord(code, inner)
      let cursor = innerEnd
      while (/\s/.test(code[cursor] ?? '')) cursor++
      if (code[cursor] === '=') {
        settingNames.push(code.slice(inner, innerEnd))
      }
      inner = innerEnd
    }
  }

  return { topLevelLimit, topLevelSetOp, maxTopLevelLimit, settingsInsertAt, settingNames }
}

/** 单独扫字面量内容：库表名与设置名经常被当作字符串参数传进表函数 */
function collectLiteralFindings(literals: string[]): string[] {
  const findings: string[] = []
  for (const literal of literals) {
    SYSTEM_REF_PATTERN.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = SYSTEM_REF_PATTERN.exec(literal)) !== null) {
      if (!SYSTEM_TABLE_WHITELIST.has(match[1].toLowerCase())) {
        findings.push(`不允许在查询参数里指定 system.${match[1]}`)
      }
    }
    SETTING_REF_PATTERN.lastIndex = 0
    while ((match = SETTING_REF_PATTERN.exec(literal)) !== null) {
      if (isForbiddenSetting(match[1])) {
        findings.push(`不允许在查询参数里修改设置：${match[1]}`)
      }
    }
  }
  return findings
}

@Injectable()
export class SqlAnalysisService {
  constructor(
    private readonly clickhouseService: ClickHouseService,
  ) {
  }

  /**
   * 校验并规范化 SQL：仅允许单条 SELECT / WITH 查询，无顶层 LIMIT 时补上行数上限
   * （普通查询直接追加 LIMIT 1000，集合运算整体包一层再限）
   *
   * 这一层是快速失败与友好报错。真正的只读保证由 executeQuery 里的 ClickHouse readonly 设置兜底。
   * @param sql 原始 SQL 语句
   */
  validateAndNormalizeSql(sql: string): string {
    if (!sql || sql.trim() === '') {
      throw new BusinessException('SQL 语句不能为空')
    }

    // 判定看掩码后的部分，原文只用来做最终返回
    const trimmed = sql.trim()
    const { code, refs, literals, endOfCode } = maskSqlLiterals(trimmed)
    const codeOnly = code.trim()

    if (codeOnly === '') {
      throw new BusinessException('SQL 语句不能为空')
    }

    // 必须以 SELECT 或 WITH 开头（集合运算的分支允许写成 (SELECT …)，见 ClickHouse UNION 文档）
    if (!/^\(*\s*(SELECT|WITH)\b/i.test(codeOnly)) {
      throw new BusinessException('仅支持 SELECT / WITH 开头的查询语句')
    }

    // 拒绝分号（多语句）
    if (code.includes(';')) {
      throw new BusinessException('不允许包含多条语句（分号）')
    }

    // 拒绝写操作关键字（按词边界匹配，SYSTEM 后紧跟 . 时为 system 数据库前缀，交给下面的表规则）
    const forbiddenPattern = new RegExp(`\\b(${FORBIDDEN_KEYWORDS.map(keyword => keyword === 'SYSTEM' ? 'SYSTEM(?!\\s*\\.)' : keyword).join('|')})\\b`, 'i')
    const forbiddenMatch = code.match(forbiddenPattern)
    if (forbiddenMatch) {
      throw new BusinessException(`不允许使用关键字：${forbiddenMatch[1].toUpperCase()}，仅支持只读查询`)
    }

    // 拒绝 REPLACE INTO / REPLACE PARTITION / TRUNCATE TABLE（这几个词本身是合法标量函数名，不能按关键字拦）
    for (const [pattern, label] of FORBIDDEN_STATEMENTS) {
      if (pattern.test(code)) {
        throw new BusinessException(`不允许使用 ${label}，仅支持只读查询`)
      }
    }

    // 拒绝 INTO OUTFILE（ClickHouse 服务端写文件）
    if (/\bINTO\s+OUTFILE\b/i.test(code)) {
      throw new BusinessException('不允许使用 INTO OUTFILE，仅支持只读查询')
    }

    // 拦只读也能干坏事的表函数 / 函数：出网、读服务器文件、跨实例查库、命令执行
    const callMatch = refs.match(FORBIDDEN_CALL_PATTERN)
    if (callMatch) {
      throw new BusinessException(`不允许使用函数：${callMatch[1]}，仅支持只读查询`)
    }

    // system 库整体拒绝（query_log 能读到别人的 SQL，users / clusters / named_collections 是凭据面）
    SYSTEM_REF_PATTERN.lastIndex = 0
    let systemMatch: RegExpExecArray | null
    while ((systemMatch = SYSTEM_REF_PATTERN.exec(refs)) !== null) {
      if (!SYSTEM_TABLE_WHITELIST.has(systemMatch[1].toLowerCase())) {
        throw new BusinessException(`不允许查询 system.${systemMatch[1]}，仅支持业务数据查询`)
      }
    }

    // 设置名：SETTINGS 在嵌套位置（CTE 体、派生表）同样要查，只看最后一个 SETTINGS 会漏
    const scan = scanCode(code)
    const forbiddenSetting = scan.settingNames.find(isForbiddenSetting)
    if (forbiddenSetting) {
      throw new BusinessException(`不允许在查询中修改设置：${forbiddenSetting}`)
    }

    // 字面量内容单独再扫一遍：库表名与设置名会被当作参数传进表函数，
    // 例如 remote('h:9000', 'system', 'query_log')、viewExplain('AST', 'readonly = 0', …)
    const literalFinding = collectLiteralFindings(literals)[0]
    if (literalFinding) {
      throw new BusinessException(literalFinding)
    }

    // 集合运算（UNION / INTERSECT / EXCEPT）的行数上限要作用在整体上：
    // ClickHouse 的 LIMIT / ORDER BY 是跟着各个分支的，直接在末尾追加 LIMIT 只会限住最后一个分支
    // （总量照样没上限），还会把最后一个分支自己的 LIMIT 顶掉。所以整体包一层再限行数，
    // 分支里的 LIMIT / ORDER BY 原样留在内层。普通查询不这么做：外层 SELECT 可能丢掉内层 ORDER BY 的顺序。
    if (scan.topLevelSetOp) {
      const cap = Math.max(1000, scan.maxTopLevelLimit ?? 0)
      const body = trimmed.slice(0, endOfCode)
      const tail = trimmed.slice(endOfCode).trim()
      const wrapped = `SELECT * FROM (${body}) LIMIT ${cap}`
      return tail ? `${wrapped} ${tail}` : wrapped
    }

    // 无顶层 LIMIT 时自动追加 LIMIT 1000
    // 插在顶层 SETTINGS 之前（LIMIT 在 SETTINGS 前面才是合法顺序），插在最后一段代码之后（否则会被行注释吃掉）
    // 只认顶层 LIMIT：子查询里的 LIMIT 不算，否则整条查询就没有行数上限了
    if (!scan.topLevelLimit) {
      const insertAt = scan.settingsInsertAt ?? endOfCode
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
        // 查询里的 SETTINGS max_execution_time 能覆盖掉这个值，所以它在禁止修改的设置名单里
        max_execution_time: 30,
        // 只读约束的真正边界：ClickHouse 自己拒绝任何非查询语句与 DDL，与关键字黑名单无关。
        // 2 = 只允许读请求、允许改其它设置、但**不允许改 readonly 本身**，
        // 所以查询里的 SETTINGS 子句照常可用，又没法用它把只读关掉。1 会连 SETTINGS 一起收到白名单里。
        readonly: '2',
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
