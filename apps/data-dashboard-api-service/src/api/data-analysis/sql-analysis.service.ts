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
 *   逐个枚举名字必漏；但 url / hive / generate 这类前缀会撞上合法函数
 * （urlHierarchy / hiveHash / generateUUIDv4），只能精确匹配
 * - 左侧断言 (?<![A-Za-z0-9_$.`])，否则 sumMerge( / arrayMerge( 会被 merge( 误伤，
 *   埋点列名 $file 也会被 file( 误伤
 *
 * 判定用的掩码（maskSqlLiterals）必须和 ClickHouse 的词法对得上，两个方向的错法不一样：
 * - 掩码**藏住了 ClickHouse 会执行的文本**是绕过（`fil\x65`( 把真名藏进转义、
 *   末尾的 `-- 星号斜杠` 让注释边界错位都是这一类），所以标识符与字面量一律按 ClickHouse 的规则解码后再判
 * - 掩码**多露出来**只是误伤一条本来合法的查询，所以拿不准的转义宁可多解一步
 */

// 左侧断言：不允许紧跟标识符字符（含 $ 与 ` ，埋点列名以 $ 开头且要反引号包裹）
const LEFT_BOUND = '(?<![A-Za-z0-9_$.\\x60])'

/**
 * ClickHouse 的空白比 JS 的 \s 宽：U+200B ZWSP / U+200C ZWNJ / U+200D ZWJ / U+2060 WJ /
 * U+0085 NEL / U+180E LEP / U+00A0 NBSP 在它的词法里都是分词空白，而 JS \s 只认其中的 NBSP。
 * 实测（play.clickhouse.com 26.10.1）`file​('/etc/passwd')` 解析出的是 file()、
 * `system​.query_log` 与 `system.​query_log` 都解析出 system.query_log，
 * 只按 \s 判就会把它们当成粘着的别的标识符而放过。
 *
 * 反过来 `sys​tem.query_log` 报的是语法错误（`.query_log` 悬空）——这些码点是**分词**空白，
 * 不是被忽略的字符。所以把它们等价成普通空格是忠实于 ClickHouse 的，不会把 token 藏掉。
 * 判定一律用这个更宽的空白类：宁可多拦（误伤一条合法查询），不能少拦。
 */
const WS_CLASS = '[\\s\\u0085\\u00ad\\u034f\\u115f\\u1160\\u17b4\\u17b5\\u180b-\\u180e\\u200b-\\u200f\\u202a-\\u202e\\u2060-\\u2064\\u206a-\\u206f\\u3164\\ufe00-\\ufe0f\\uffa0]'
const WS_ANY = WS_CLASS + '*'
const WS_ONE = new RegExp('^' + WS_CLASS + '$')
const WS_TRIM = new RegExp('^' + WS_CLASS + '+|' + WS_CLASS + '+$', 'g')

const isWs = (ch: string | undefined) => ch !== undefined && WS_ONE.test(ch)
const trimSql = (text: string) => text.replace(WS_TRIM, '')

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
  [new RegExp(`\\bREPLACE${WS_ANY}(INTO|PARTITION)\\b`, 'i'), 'REPLACE INTO / REPLACE PARTITION'],
  [new RegExp(`\\bTRUNCATE${WS_ANY}(TABLE|DATABASE)\\b`, 'i'), 'TRUNCATE TABLE / TRUNCATE DATABASE'],
]

/**
 * 只读查询里也必须拦掉的函数（表函数 + 有副作用或会越权的标量函数）。
 * 前缀命中即拦。
 */
const FORBIDDEN_CALL_PREFIXES = [
  // 出网 / 外部数据源：url() 能打到 169.254.169.254 与 8123 回环，把第二条查询藏在参数里绕开本文件；
  // mysql()/postgresql() 的第三个参数会拼进远端语句，等于在别人的库上执行 SQL；
  // remote()/cluster() 用的是 remote_servers 里配的服务端凭据，是拿服务端身份去别的实例查
  // ai() 系列（aiGenerate / aiEmbed / aiClassify …）会拿 named collection 里的服务端凭据去调外部 AI API，
  //   `SELECT aiEmbed('a', 'b')` 实测报「AI function requires credentials」，是纯 SELECT 就够的出网口子
  'ai',
  's3', 'hdfs', 'azureBlobStorage', 'gcs', 'cosn', 'oss', 'objectStorage',
  'iceberg', 'deltaLake', 'hudi', 'paimon', 'arrowFlight', 'bigQuery', 'ytsaurus',
  'prometheus', 'meilisearch', 'nats', 'rabbitmq', 'kafka', 'elastic',
  'mysql', 'postgres', 'mongo', 'redis', 'odbc', 'jdbc',
  'merge', 'cluster', 'remote', 'dictionary', 'view', 'input',
  // 跨库读表：buffer() / merge() 的库名表名是字符串参数，写死 system.query_log 也查得到
  'buffer',
  // 本地文件与命令执行
  'file', 'filesystem', 'disk', 'sqlite', 'executable', 'eval', 'loop', 'catBoost',
  // 字典 / 物化视图取数，读的是别的表
  'dict', 'joinGet',
  // 结构 / 权限探测：hasColumnInTable 探列存不存在；
  // assignCentroid 的第二个参数能写字典名，等于去读另一张表——不是误伤，别放开
  'hasColumnInTable', 'assignCentroid',
  // 把查询字符串改写 / 解析成别的形态
  'fuzzQuery',
  // 拖时间，能把执行线程占满
  'sleep',
  // 服务器指纹 / 请求头泄露 / 内省
  'hostName', 'serverUUID', 'tcpPort', 'getClientHTTPHeader', 'demangle', 'addressTo',
  'stackTrace', 'FQDN', 'version',
  // 索引与投影探测、ZooKeeper / Keeper 侧信道
  'mergeTree', 'zookeeper', 'keeper',
  // 读系统设置与宏：getSetting('readonly') 实测**不需要任何 grant** 就返回 1，
  // getServerSetting / getMergeTreeSetting / getMacro 报的是「grant SELECT ON system.server_settings」
  // 这类缺权限——说明它们内部就是去读 system 库，等于绕开整条 system 库规则去探服务端配置。
  // 前缀匹配顺带覆盖 getSettingOrDefault / getMaxTableName 等变体
  'getSetting', 'getServerSetting', 'getMergeTreeSetting', 'getMacro', 'getMaxTableName',
  // TimeSeries 表函数：两参写法 timeSeriesTags('system', 'query_log') 实测把库名表名
  // 解析成了 system.query_log 并回显它的引擎与表 UUID（元数据侧信道）
  'timeSeries',
  // 拿字符串当 SQL / JSON 二次解析：本身不执行，但能把我们判定过的语句改写或解析成 AST，
  // 是一个能绕过「判定所依据的文本」的改写入口。fuzzBits 刻意**不**拦（纯位运算，见 probe.mts）
  'formatQuery', 'normalizeQuery', 'normalizedQuery', 'obfuscateQuery', 'highlightQuery', 'parseQuery',
]

/**
 * 必须精确匹配的名字：按前缀会误伤同前缀的合法函数。
 * url -> urlHierarchy、hive -> hiveHash、generate -> generateUUIDv4 / generateULID
 */
const FORBIDDEN_CALLS = [
  'url', 'urlCluster',
  'hive',
  // generateSeries / generate_series 是 range() 的别名、边界是显式给的常量，
  // 跟被拦的 numbers() 一族是同一个语义，拦它们只是误伤；generateRandom 的结构是随机的，照拦
  'generateRandom',
  // fullHostName 撞不上 hostName 前缀（左边多了 ful），只能列全名。
  // current 不能当前缀：currentDate / currentDateTime / currentDatabase 都是高频合法函数
  'fullHostName', 'getOSKernelVersion', 'getServerPort',
  'currentRequestURL', 'currentHandler', 'currentUser', 'authUser', 'authenticatedUser',
  'currentQueryID', 'initialQueryID', 'initialQueryStartTime',
  'currentRoles', 'currentProfiles', 'enabledProfiles', 'defaultProfiles', 'connectionId',
  'isMergeTreePartCoveredBy', 'shardNum', 'shardCount',
  // 字符串二次解析：fuzzQuery 走前缀、这几个走全名
  'fuzzJSON', 'generateRandomStructure', 'parseQueryToJSON',
]

/**
 * 前缀命中之后的白名单：这些名字前缀撞上了拦截词，本身却是无害的标量 / 哈希函数。
 * 按**精确小写名**放行，且要继续扫后面的名字（`SELECT kafkamurmurhash(a), kafka(…)` 里的
 * 第二个照拦）。
 */
const SAFE_CALL_EXEMPTIONS = new Set([
  'kafkamurmurhash',
  'iceberghash', 'icebergbucket', 'icebergtruncate',
  'mergedjsonpatch',
  'evalmlmethod',
])

// 拦只读也能干坏事的表函数 / 函数。名字与 ( 之间允许隔着空白与引号：
// refs 里引用标识符写成「空格 + 解码后的名字 + 空格」（`` `fil\x65`(` `` → ` file `(` `），
// 所以 `名字(` 得按 `名字\s*\(` 认，否则换行 / 注释 / 引号标识符拆开名字与括号就漏了；
// 再多留一个可选引号是纯保险（refs 现在不带引号），方向是多拦不是少拦
const FORBIDDEN_CALL_PATTERN = new RegExp(
  LEFT_BOUND + `((?:${FORBIDDEN_CALL_PREFIXES.join('|')})[A-Za-z0-9_]*|${FORBIDDEN_CALLS.join('|')})${WS_ANY}["\\x60]?${WS_ANY}\\(`,
  'ig',
)

/** 找第一个真正要拦的调用：前缀撞车但无害的名字（kafkamurmurhash…）放行，后面的名字照扫 */
function findForbiddenCall(refs: string): string | null {
  FORBIDDEN_CALL_PATTERN.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = FORBIDDEN_CALL_PATTERN.exec(refs)) !== null) {
    const name = match[1]
    if (!SAFE_CALL_EXEMPTIONS.has(name.toLowerCase())) return name
  }
  return null
}

/**
 * system 库整体拒绝，只放行 one / numbers / zeros 这几个纯生成表。
 * 不逐个列 system 表名：ClickHouse 每个版本都在加新表（query_cache / user_query_log /
 * keeper_* …），逐个列的黑名单注定落后一版，禁掉整个库才对未来版本免疫。
 *
 * 两段标识符的引号与内部空白都算可选：refs 里 `` `system`.`query_log` `` 是
 * ` system ` . ` query_log `（引号被换成空格，`system\s*\.\s*` 认得出），
 * 但字面量里是**原文**的 `system`.`query_log`，点号两边隔着真正的反引号，不带引号容忍就认不出来。
 * 左边的界定不排反引号（跟 LEFT_BOUND 不同）：`FROM`system`.one` 里 system 前面直接是反引号。
 * 这条规则是二阶注入的兜底——`SETTINGS select = '…'` 的值会被重新解析成 SQL，
 * 藏在字面量里的表名就是从这条路进来的。
 *
 * 不带 i 标志：ClickHouse 的标识符**区分大小写**，实测 `SELECT 1 FROM SYSTEM.one` 与
 * `System.one` 都报「Database SYSTEM does not exist」，所以 `System.IO` 这类 .NET 异常名、
 * `kube-dns.kube-system.svc` 这类 k8s 域名永远不可能重新解析成 system 库。
 * 左边界也放宽到路径 / 域名里常见的字符（- / % @ # \）：
 * `/etc/system.d/nginx.conf` 与 `kube-system.svc` 不再被误伤，
 * 而 `` ` `` 必须留着——`FROM `system`.query_log` 里 system 前面就是反引号。
 */
const SYSTEM_REF_PATTERN = new RegExp(
  '(?<![A-Za-z0-9_$.\\-/%@#\\\\])["\\x60]?' + WS_ANY + 'system' + WS_ANY + '["\\x60]?' + WS_ANY + '\\.' + WS_ANY + '["\\x60]?' + WS_ANY + '([A-Za-z_$][A-Za-z0-9_$]*)',
  'g',
)
const SYSTEM_TABLE_WHITELIST = new Set(['one', 'numbers', 'numbers_mt', 'numbersmt', 'zeros', 'zeros_mt', 'zerosmt'])

/**
 * 查询里不许改的设置。
 * readonly=2 的语义是「除 readonly 外所有设置查询可改」，所以不能只盯 readonly 自己：
 * 下面这些会让只读查询打开出网 / 凭据 / 泄密 / 二次解析的口子。
 * 真正的硬约束要在 ClickHouse profile 的 <constraints> 里把这些设置逐个 <readonly/> 钉死。
 */
/**
 * 查询构造类设置：ClickHouse 会拿这些值去**改写已经解析好的查询**——`select` 包成
 * `SELECT <expr_list> FROM (<query>)`、`order` / `sort` 加一层 ORDER BY、`filter` 加一层
 * WHERE、`format` 覆盖查询里写的 FORMAT、`limit` / `offset` / `page` 调整行数（0 = 不限）。
 *
 * 值是会被重新解析成 SQL 的表达式列表，实测（play.clickhouse.com 26.10.1）
 * `SELECT 2 SETTINGS select = '(SELECT 1 FROM \`system\`.\`one\`)'` 直接返回 1。
 * 更要命的是 readonly 兜不住它：同一台机器上 `SETTINGS final = 1` 报 READONLY，
 * 而这 8 个在查询里全部 200。所以按名字禁掉是**唯一**的防线。
 *
 * 二阶注入的 payload 藏在字符串字面量里，函数名黑名单（version( 在字面量里根本看不见）
 * 与 system 库判定都会被绕开，只能整组禁名字。
 */
const QUERY_CONSTRUCTION_SETTINGS = ['select', 'order', 'sort', 'filter', 'format', 'limit', 'offset', 'page']

const FORBIDDEN_SETTINGS = [
  ...QUERY_CONSTRUCTION_SETTINGS,
  // 解除只读与约束
  'readonly', 'constraints', 'changeable_in_readonly',
  // 出网与凭据
  'use_environment_credentials', 's3_allow_server_credentials_in_user_queries',
  // 服务器文件路径与响应头注入
  'user_files_path', 'user_scripts_path', 'http_response_headers',
  // 泄密
  'format_display_secrets_in_show_and_select', 'query_cache_share_between_users',
  // 换一套解析语义，等于换方言绕开上面的判定
  'dialect', 'compatibility', 'enable_json_ast_dialect', 'enable_trino_dialect', 'polyglot_dialect',
  // 纯 SELECT 也会落盘的写副作用（JIT 编译产物）
  'compile_expressions',
  // 值会被重新解析成 SQL 表达式：跟 filter / select / order 同一个注入面，
  // payload 藏在字符串字面量里，函数名黑名单与 system 库判定都看不见它
  'additional_result_filter', 'additional_table_filters', 'parallel_replicas_custom_key',
  // 库名覆盖：`SETTINGS database = 'system'` 等价于 `USE system`，不带库名的表会落进 system 库，
  // 整条 system 库规则就被绕过去了（实测 `SELECT 1 FROM one SETTINGS database = 'system'` 返回 1，
  // `FROM query_log` 也被解析成 system.query_log）
  'database', 'promql_database', 'promql_table',
  // 出网地址改写：s3() / url() 的基地址、并行副本走哪个集群，指向的都是服务端已配的凭据
  's3_base', 'url_base', 'cluster_for_parallel_replicas',
  // file() 处理完之后按模式给文件改名，是写服务器文件
  'rename_files_after_processing',
  // 不写 FROM 的查询去读哪张表：设成 system.query_log 就把 system 库规则绕过去了
  'implicit_table_at_top_level',
  // 输出格式由服务端定：default_format / errors_output_format 是换输出格式，
  // framing_output_format 还能把**服务器日志**与 profile events 拼进响应流
  'default_format', 'errors_output_format', 'framing_output_format',
]

const FORBIDDEN_SETTING_PREFIXES = [
  // 权限开关一律不许开：allow_ddl / allow_experimental_* / allow_introspection_functions /
  // allow_get_client_http_header / allow_unrestricted_reads_from_keeper …
  'allow_',
  // 资源上限一律不许改：max_memory_usage = 0 是不限内存、max_execution_time = 0 是不限时长、
  // max_bytes_before_external_sort = 0 是不落盘外排，几条一起写能把整台 ClickHouse 打挂。
  // 这些由服务端 profile 定，查询里出现就直接拒绝
  'max_',
  // 日志外带
  'send_logs_', 'dynamic_disk_allow_',
  // AI 函数的凭据与 token 额度：ai_function_text_default_credentials 指的是 named collection，
  // 改它等于换一套服务端凭据去调外部 AI API，token 上限也能改成不限
  'ai_function_',
  // JIT 编译产物落盘：纯 SELECT 也会往磁盘写 .so
  'compile_',
  // 格式解析器行为：format_template_resultset / format_template_row 是**读服务器文件**当模板、
  // format_schema_source = 'file' / 'url' 是读文件或出网取 schema、
  // format_avro_schema_registry_url 是出网、input_format_record_errors_file_path 是写文件。
  // 输出格式由服务端定，查询里不该配置格式解析器
  'format', 'input_format', 'output_format',
  // 查询缓存：跨用户取结果只靠 query_cache_share_between_users 这一个开关，整个家族都不许动
  'query_cache_',
  // 换一套解析语义：跟 dialect / compatibility 同一个理由（换方言绕开上面的判定）
  'analyzer_compatibility_', 'polyglot_',
]

/**
 * 字面量内容里只拦「一旦被某个带 settings 参数的函数吃到就能破只读」的名字。
 * 不扫 allow_ / max_ 前缀：埋点数据里出现 'max_execution_time = 0'、'allow_experimental_… = 1'
 * 这类日志与配置文本并不罕见，而字面量二次扫描是失效即关的，误伤面要压在真正致命的名字上。
 * （这两类在查询里的修改仍由上面的 SETTINGS 规则拦。）
 *
 * QUERY_CONSTRUCTION_SETTINGS 同样不进这张表：'limit = 10'、'order = 1'、'format = JSON'
 * 是埋点日志与配置文本里极常见的片段，而能拿字符串当 settings 参数去调的入口
 * （viewExplain / EXPLAIN / mysql / remote / fuzzQuery）已经被函数名规则整只拦掉了。
 */
const LITERAL_FORBIDDEN_SETTINGS = [
  ...FORBIDDEN_SETTINGS.filter(name => !QUERY_CONSTRUCTION_SETTINGS.includes(name)),
  'allow_ddl', 'send_logs_level', 'send_logs_source_regexp',
]

/**
 * 字面量里的「名字 = 值」形状。只认整条或逗号分隔后的开头：
 * 埋点日志与配置文本里 `'please set readonly=1'`、`'k=v, a=b'` 这类自然语言片段很常见，
 * 但真正会被当 settings 参数吃进去的字符串都是 `readonly = 0`、`a=1, readonly=0` 这种形状，
 * 所以锚在 `^` 或 `,` / `;` 之后。剩下的已知误伤是内容恰好是 `dialect=ansi` 这种整条配置项的字面量。
 */
const SETTING_REF_PATTERN = new RegExp('(^|[,;])' + WS_ANY + '([A-Za-z_][A-Za-z0-9_]*)' + WS_ANY + '=', 'g')

function isForbiddenSetting(name: string): boolean {
  const lower = name.toLowerCase()
  return FORBIDDEN_SETTINGS.includes(lower)
    || FORBIDDEN_SETTING_PREFIXES.some(prefix => lower.startsWith(prefix))
}

function isForbiddenLiteralSetting(name: string): boolean {
  return LITERAL_FORBIDDEN_SETTINGS.includes(name.toLowerCase())
}

interface IMaskedSql {
  /** 字面量、注释、引用标识符都替换成等长空白，用于关键字 / 分号 / LIMIT 判定 */
  code: string
  /** 代码字符原样，注释与字符串字面量压成一个空格，引用标识符换成解码后的内容，
   *  用于表名 / 函数名判定——`fil\x65`( 在这里就是 file( ） */
  refs: string
  /** 与原文等长：引用标识符换成解码后的真名（尾部补空格）、字面量整段打成 HOLE、
   *  注释与普通字符照抄。用于「名字 = 值」这类要认名字的地方——
   *  SETTINGS 的名字允许写成反引号 / 双引号标识符，只看 code 会把它当成空白漏掉 */
  named: string
  /** 引用标识符的区间与解码后的真名，按起始下标查。
   *  named 里真名后面补的是空白，真名**自己**也可能带空格 / 点号 / 逗号
   *  （`SQL_my setting`、`SQL_a,b` 在 ClickHouse 里都是合法设置名），
   *  光在 named 上按词读会把名字读断，认不出 `=` 就会把整条 SETTINGS 子句漏掉 */
  identifiers: Map<number, { end: number; name: string }>
  /** 字符串字面量解码后的内容（$…$ 定界串按 ClickHouse 语义原样保留），库表名与设置名
   *  会被当作参数传进表函数，要单独再扫一遍 */
  literals: string[]
  /** 最后一段有效代码（不含注释与空白）的结束下标，用于追加 LIMIT */
  endOfCode: number
}

/** named 里字面量的占位符：认名字 / 认表达式时要能看出「这里原本有内容，只是不参与结构」 */
const HOLE = String.fromCharCode(1)

/**
 * ClickHouse 的转义序列解码（parseEscapeSequence）：\xNN 与 \0NN 是解码的，
 * 不认识的转义（\q）会把反杠连同后面的字符一起留下。
 *
 * 这里一律按「能解就解、解不动就取后面那个字符」处理，比 ClickHouse 更激进：
 * 解过头最多让一条本来就会被 ClickHouse 判成未知标识符的查询被我们提前拦下，
 * 解不足却会让 `fil\x65`( 这种真名逃过函数名黑名单。
 */
const SIMPLE_ESCAPES: Record<string, string> = {
  a: '\x07', b: '\b', f: '\f', v: '\v', t: '\t', n: '\n', r: '\r',
  '\\': '\\', "'": "'", '"': '"', '`': '`',
}

function decodeEscape(text: string, index: number): { char: string; length: number } {
  const marker = text[index + 1]
  if (marker === undefined) return { char: '\\', length: 1 }

  if (marker === 'x' || marker === 'X') {
    const hex = /^[0-9a-fA-F]{1,2}/.exec(text.slice(index + 2))?.[0]
    if (hex) return { char: String.fromCharCode(parseInt(hex, 16)), length: 2 + hex.length }
  }
  if (marker === 'u' || marker === 'U') {
    const uni = /^(\{[0-9a-fA-F]{1,6}\}|[0-9a-fA-F]{1,8})/.exec(text.slice(index + 2))?.[0]
    if (uni) {
      const code = Number.parseInt(uni.replace(/[{}]/g, ''), 16)
      // 超出码点范围时按「解不动」处理（\U00110000 会让 fromCodePoint 抛异常）
      const decoded = Number.isFinite(code) && code <= 0x10ffff ? String.fromCodePoint(code) : ''
      return { char: decoded, length: 2 + uni.length }
    }
  }
  if (marker >= '0' && marker <= '7') {
    const octal = /^[0-7]{1,3}/.exec(text.slice(index + 1))?.[0] ?? marker
    return { char: String.fromCharCode(parseInt(octal, 8)), length: 1 + octal.length }
  }
  return { char: SIMPLE_ESCAPES[marker] ?? marker, length: 2 }
}

/** 去掉首尾引号后的内容解码：\ 转义与成对引号都要还原成真实字符（ClickHouse 两种都认） */
function decodeQuotedContent(raw: string, quote: string): string {
  let out = ''
  let k = 0
  while (k < raw.length) {
    const ch = raw[k]
    if (ch === '\\') {
      const decoded = decodeEscape(raw, k)
      out += decoded.char
      k += decoded.length
      continue
    }
    if (ch === quote && raw[k + 1] === quote) {
      out += quote
      k += 2
      continue
    }
    out += ch
    k++
  }
  return out
}

/**
 * 把字符串字面量、带引号的标识符与注释替换成等长空白。
 *
 * 判定只看代码部分，这样：
 * - 不会因为 `WHERE title LIKE '%update%'`、`WHERE s = 'a; b'` 这类字面量而误判成写操作
 * - 原文一字不改地交给 ClickHouse，注释里写 `--` `#` `/*` 不会破坏查询
 * - 等长替换让 code 上的下标可以直接用回原文（追加 LIMIT 时要用）
 *
 * 引用标识符在 code 里被抹掉、在 refs 里留下**解码后**的内容：标识符是结构不是数据，
 * 抹掉会让 `system`.`query_log` 这种写法躲过所有表名规则，不解码则会让
 * `fil\x65`( 、`syste\x6d`.query_log 躲过去。但关键字判定仍看 code，
 * 免得 `$update`、`$delete` 这类反引号包裹的埋点列名撞上写关键字。
 *
 * 注释的词法要跟 ClickHouse 完全一致（// 是行注释、# 后面跟空白或 ! 才是、块注释可嵌套）：
 * 这里藏得比 ClickHouse 多就会把 payload 整段盖住，掩码里看不见 = 一条规则都不生效。
 *
 * 注意：这里只是为了让下面的判定尽量准确。真正的只读边界是 ClickHouse 的 readonly 设置。
 */
function maskSqlLiterals(sql: string): IMaskedSql {
  const n = sql.length
  const codeArr = new Array<string>(n)
  const namedArr = new Array<string>(n)
  const refParts: string[] = []
  const literals: string[] = []
  const identifiers = new Map<number, { end: number; name: string }>()
  let endOfCode = 0
  let i = 0

  // 把 [i, end) 打成空白：code 一律空格，named 里标识符留真名、字面量整段打成 HOLE
  // （真名一定放得下：所有转义都是缩短的，引号本身还占两位）
  const blank = (end: number, options: { name?: string; literal?: boolean; asCode?: boolean }) => {
    const stop = Math.min(end, n)
    for (let k = i; k < stop; k++) {
      codeArr[k] = ' '
      namedArr[k] = options.literal ? HOLE : ' '
    }
    // 注释与字面量在 refs 里压成一个空格：既能挡住 system/**/.query_log 这类拆开的写法
    // （ClickHouse 的注释不会把两个标识符合成一个），又不会让相邻标识符粘连
    refParts.push(options.name === undefined ? ' ' : ` ${options.name} `)
    const nameLength = Math.min(options.name?.length ?? 0, stop - i)
    for (let k = 0; k < nameLength; k++) {
      namedArr[i + k] = (options.name as string)[k]
    }
    if (options.asCode) {
      endOfCode = stop
    }
    i = stop
  }

  while (i < n) {
    const ch = sql[i]
    const next = sql[i + 1]

    // -- 与 // 是行注释（都不用跟空格）
    if ((ch === '-' && next === '-') || (ch === '/' && next === '/')) {
      let j = i
      while (j < n && sql[j] !== '\n') j++
      blank(j, {})
      continue
    }

    // # 只有后面跟空白或 ! 时才是行注释，否则 ClickHouse 直接判成词法错误。
    // 这里也直接拒绝：放过它的话我们追加的 " LIMIT 1000" 会把 # 变成合法注释，行数上限就没了
    if (ch === '#') {
      if (next !== '!' && (next === undefined || !isWs(next))) {
        throw new BusinessException('SQL 语句中存在无法解析的 #（# 后面必须跟空白或 ! 才是注释）')
      }
      let j = i
      while (j < n && sql[j] !== '\n') j++
      blank(j, {})
      continue
    }

    // /* 块注释 */：ClickHouse 的块注释是可嵌套的，`/* /* */ */` 后面的内容照样在注释里
    if (ch === '/' && next === '*') {
      let j = i + 2
      let level = 1
      while (j < n && level > 0) {
        if (sql[j] === '/' && sql[j + 1] === '*') {
          level++
          j += 2
          continue
        }
        if (sql[j] === '*' && sql[j + 1] === '/') {
          level--
          j += 2
          continue
        }
        j++
      }
      if (level > 0) {
        throw new BusinessException('SQL 语句中存在未闭合的注释')
      }
      blank(j, {})
      continue
    }

    // '...' 字符串字面量：支持 \ 转义与 '' 转义
    if (ch === "'") {
      let j = i + 1
      let closed = false
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
          closed = true
          break
        }
        j += 1
      }
      if (!closed) {
        throw new BusinessException('SQL 语句中存在未闭合的字符串')
      }
      literals.push(decodeQuotedContent(sql.slice(i + 1, j - 1), "'"))
      blank(j, { literal: true, asCode: true })
      continue
    }

    // `..." 与 "..." 引用标识符（$ 开头的埋点列必须用反引号）：
    // \ 转义与成对引号转义都认（ClickHouse 两种都支持），少认一种就会让掩码的区间
    // 和 ClickHouse 的错开，藏在后面的 SETTINGS / LIMIT 判定不到
    if (ch === '`' || ch === '"') {
      let j = i + 1
      let closed = false
      while (j < n) {
        if (sql[j] === '\\') {
          j += 2
          continue
        }
        if (sql[j] === ch) {
          if (sql[j + 1] === ch) {
            j += 2
            continue
          }
          j += 1
          closed = true
          break
        }
        j += 1
      }
      if (!closed) {
        throw new BusinessException('SQL 语句中存在未闭合的引用标识符')
      }
      const name = decodeQuotedContent(sql.slice(i + 1, j - 1), ch)
      identifiers.set(i, { end: j, name })
      blank(j, { name, asCode: true })
      continue
    }

    // $$...$$ / $tag$...$tag$ 定界字符串（tag 允许数字开头）。
    // 只在 token 起点开：`x$a$hello$a$` 在 ClickHouse 里是一个标识符（实测报
    // Unknown expression identifier `x$a$hello$a$`），在中间当成定界串会把标识符切碎。
    //
    // 而且**必须找得到闭合的 $tag$ 才算字符串**，否则回退成标识符：实测
    // `SELECT ($hello$) AS v` 报 Unknown expression identifier `$hello$`（是标识符！），
    // `SELECT ($a$b)` / `($a$hello)` 同理，只有 `SELECT ($$hello)` 这种空 tag 没闭合的
    // 才报语法错误。所以空 tag 没闭合时直接拒绝（照抄 ClickHouse 的判定），
    // 带 tag 没闭合就当普通标识符字符继续往下走——不然 `SELECT $hello` 这种会被误拒。
    if (ch === '$' && !isWordChar(sql[i - 1])) {
      const delimiter = /^\$(\w*)\$/.exec(sql.slice(i))
      if (delimiter) {
        const close = sql.indexOf(delimiter[0], i + delimiter[0].length)
        if (close === -1) {
          if (delimiter[1] === '') {
            throw new BusinessException('SQL 语句中存在未闭合的字符串')
          }
          // 没有闭合的 $tag$：ClickHouse 会把整段当标识符，这里也按普通字符处理
        } else {
          // 定界串里没有转义，ClickHouse 拿到的就是原文，这里也不解码
          literals.push(sql.slice(i + delimiter[0].length, close))
          blank(close + delimiter[0].length, { literal: true, asCode: true })
          continue
        }
      }
    }

    codeArr[i] = ch
    namedArr[i] = ch
    refParts.push(ch)
    if (!isWs(ch)) {
      endOfCode = i + 1
    }
    i++
  }

  for (let k = 0; k < n; k++) {
    if (codeArr[k] === undefined) codeArr[k] = ' '
    if (namedArr[k] === undefined) namedArr[k] = ' '
  }

  return { code: codeArr.join(''), refs: refParts.join(''), named: namedArr.join(''), literals, identifiers, endOfCode }
}

const isWordChar = (ch: string | undefined) => ch !== undefined && /[A-Za-z0-9_$]/.test(ch)
const isLetter = (ch: string | undefined) => ch !== undefined && /[A-Za-z_]/.test(ch)
/** 标识符开头：$ 在 ClickHouse 的设置名里也算（`SETTINGS $x = 1` 是 UNKNOWN_SETTING 而不是语法错误） */
const isNameStart = (ch: string | undefined) => ch !== undefined && /[A-Za-z_$]/.test(ch)

function readWord(code: string, start: number): number {
  let end = start
  while (isWordChar(code[end])) end++
  return end
}

const isWordStart = (code: string, index: number) => isLetter(code[index]) && !isWordChar(code[index - 1])

// 集合运算：ClickHouse 的 LIMIT / ORDER BY 跟着各个分支走，行数上限要作用在整体上
const SET_OPERATION_WORDS = new Set(['UNION', 'INTERSECT', 'EXCEPT'])

interface ICodeScan {
  /** 顶层（括号深度 0）是否已有写明行数的 LIMIT */
  topLevelLimit: boolean
  /** 顶层是否是集合运算（UNION / INTERSECT / EXCEPT），这类要把整体包一层再限行数 */
  topLevelSetOp: boolean
  /** 顶层 LIMIT 子句里写到的最大行数（LIMIT n / LIMIT offset, n / LIMIT n OFFSET m 里取最大），没写或解析不出时为 null */
  maxTopLevelLimit: number | null
  /** 顶层 LIMIT 后面写的是常量表达式（LIMIT toUInt64(5)），行数定不下来，只能包一层限行数 */
  limitClauseUnknown: boolean
  /** 顶层尾部子句（FORMAT / SETTINGS）的起始下标，LIMIT 要插在它前面：
   *  这两个关键字后面再写 LIMIT 是语法错误（实测 `SELECT 2 AS a FORMAT TSV LIMIT 5` 与
   *  `… SETTINGS log_comment = 1 LIMIT 5` 都报 Code: 62），而它们又可以互相跟着写 */
  limitInsertAt: number | null
  /** 所有 SETTINGS 子句（含嵌套）里出现的设置名 */
  settingNames: string[]
}

/**
 * 扫一遍代码部分，取出顶层 LIMIT / 集合运算 / SETTINGS 的位置与全部设置名。
 *
 * 必须区分括号深度：`WHERE 1 IN (SELECT 1 LIMIT 1)` 里的 LIMIT 是子查询的，
 * 不能拿它当「已经限过行了」，否则整条查询的结果集与扫描量就没上限了。
 *
 * LIMIT / SETTINGS 都是关键字也是常见列名（`SELECT limit, settings FROM t` 是合法查询），
 * 只认词本身会让列名冒充子句：要么被当成「已经限过行」而漏掉行数上限，
 * 要么把 LIMIT 插到列名前面把查询改坏。所以按后面的写法判断是不是子句。
 */
/**
 * 跳过空白与注释（named 里注释就是空白，字面量是 HOLE 段，标识符是真名 + 空白补齐）。
 * 认「名字 = 值」这类结构时用它对齐到下一个真正参与语法的 token。
 *
 * 不能走进引用标识符的区间：named 里真名后面补的是空白，而真名**自己**带空格时
 * （`SQL_a . \` x y\` = 2` 解码出来是 ` x y`）按空白跳就会停在真名中间，
 * 读出来的名字断在 `SQL_a.x`、end 落在区间里，认不出后面的 =，
 * 整条 SETTINGS 子句——连同后面的 `max_memory_usage = 0`——就从判定里消失了。
 */
function skipTrivia(
  named: string,
  start: number,
  identifiers: Map<number, { end: number; name: string }>,
): number {
  let p = start
  while (p < named.length && isWs(named[p]) && !identifiers.has(p)) p++
  return p
}

/**
 * SETTINGS 子句里的名字：普通标识符、反引号 / 双引号标识符，以及点号连起来的复合名字
 * （`SETTINGS \`readonly\` = 0`、`SETTINGS SQL_a.b = 1` 在 ClickHouse 里都是合法写法）。
 *
 * 引用标识符要按区间取真名：named 里真名后面补的是空白，真名**自己**还可能带空格 / 点号 / 逗号
 * （`SQL_my setting`、`SQL_a,b` 都是合法的自定义设置名），按词读会把名字读断，
 * 认不出后面的 = 就会把整条 SETTINGS 子句——连同真正想拦的设置——整段漏掉。
 *
 * 认不出来（字符串字面量、替换参数、别的标点）就返回 null：ClickHouse 只接受 identifier 当名字，
 * 这些写法它自己会判成语法错误，这里不用替它操心。
 */
function readSettingName(
  named: string,
  identifiers: Map<number, { end: number; name: string }>,
  start: number,
): { name: string; end: number } | null {
  const segments: string[] = []
  let end = skipTrivia(named, start, identifiers)
  for (;;) {
    const quoted = identifiers.get(end)
    if (quoted) {
      segments.push(quoted.name)
      end = quoted.end
    } else if (isNameStart(named[end])) {
      let wordEnd = end
      // 粘着的引用标识符要让开：`a`b`` 里两段在 named 上是连着的，按词读会读成一个 ab
      while (isWordChar(named[wordEnd]) && !identifiers.has(wordEnd)) wordEnd++
      segments.push(named.slice(end, wordEnd))
      end = wordEnd
    } else {
      break
    }
    const dot = skipTrivia(named, end, identifiers)
    if (named[dot] !== '.') break
    const afterDot = skipTrivia(named, dot + 1, identifiers)
    if (!identifiers.has(afterDot) && !isNameStart(named[afterDot])) break
    end = afterDot
  }
  return segments.length > 0 ? { name: segments.join('.'), end } : null
}

/**
 * 这些词是解析关键字，当不了设置名，出现在名字位置说明这不是 SETTINGS 子句
 * （`CASE WHEN … THEN … ELSE settings END = 1` 里的 settings 是列名，END 才是它后面的 token）。
 *
 * 注意名单里**不能**放任何我们关心的设置名：dialect / readonly / compatibility / constraints /
 * compile_expressions 以及 allow_ / max_ / send_logs_ 前缀的一个都没有，
 * 所以跳过这些词只会少误伤，不会把想拦的设置放过去。
 *
 * 尤其不能放 ClickHouse 真有的设置名——设置名查找是**区分大小写**的，内置名全是小写，
 * 所以 `SETTINGS LIMIT = 1` 报 UNKNOWN_SETTING、`SETTINGS limit = 1` 是 200。
 * 拿大写去试会得出「这批词都 fail-closed」的错误结论。对 system.settings（1852 行）
 * 逐行比对过：跟关键词撞名的设置名有且只有 final / format / limit / offset / order / select
 * 这 6 个，全都是上面整组禁掉的查询构造类设置，已经从这里删掉。
 * guard-check.mts 会用 isForbiddenSetting 反查这张表，撞名混进来直接判失败。
 */
const NOT_SETTING_NAME_WORDS = new Set([
  'ALL', 'AND', 'ANY', 'ANTI', 'AS', 'ASC', 'BETWEEN', 'BOTH', 'BY', 'CASE', 'CAST', 'CROSS',
  'DESC', 'DISTINCT', 'ELSE', 'END', 'EXCEPT', 'EXISTS', 'FALSE', 'FIRST',
  'FROM', 'FULL', 'GLOBAL', 'GROUP', 'GROUPING', 'HAVING', 'ILIKE', 'IN', 'INDEX', 'INNER',
  'INTERSECT', 'INTO', 'IS', 'JOIN', 'KEY', 'LAST', 'LATERAL', 'LEADING', 'LEFT', 'LIKE',
  'NATURAL', 'NOT', 'NULL', 'NULLS', 'ON', 'OR', 'OUTER', 'OUTFILE',
  'OVER', 'PARALLEL', 'PARTITION', 'PREWHERE', 'RANGE', 'RIGHT', 'ROLLUP', 'ROWS', 'SAMPLE',
  'SEMI', 'SETTINGS', 'TABLE', 'THEN', 'TIES', 'TOTALS', 'TRAILING', 'TRUE', 'UNION',
  'USING', 'WHEN', 'WHERE', 'WINDOW', 'WITH',
])

/**
 * 解析 `SETTINGS 名字 = 值[, 名字 = 值…]`，返回设置名列表与「这里到底是不是 SETTINGS 子句」。
 * 一对都没解析出来时返回 null。
 *
 * 名字紧跟在 SETTINGS 后面（中间只允许空白与注释），`SELECT user_id, settings FROM users
 * WHERE plan = 'pro'` 里的 settings 是列名，认成子句会把 LIMIT 插到列名前面把查询改坏。
 * 名字本身按 named 解析：反引号 / 双引号标识符已经解码成真名（`SETTINGS \`readonly\` = 0`
 * 在 ClickHouse 里是合法写法），字符串字面量与替换参数当名字会被 ClickHouse 自己判成语法错误。
 *
 * `isClause` 只由**第一对**名字决定（关键词打头就不是子句），它只用来决定 LIMIT 要不要插到这前面：
 * `CASE WHEN … THEN … ELSE settings END = 1` 里 END 后面的 = 是比较表达式，不是赋值。
 *
 * 名字则一直收到最后一对、撞上关键词也不中断：ClickHouse 的设置名查找区分大小写、内置名全是小写，
 * 跟关键词撞名的真有 final / format / limit / offset / order / select 这 6 个设置。
 * `SETTINGS limit = 1, max_memory_usage = 0` 里老代码在 limit 上就 break，
 * 后面的 max_memory_usage 会从判定里消失而 ClickHouse 照样应用它。所以撞名只影响 isClause，
 * 不影响收名字——多收的名字最多少误伤不了，方向是拒绝而不是放过。
 */
function readSettingsClause(
  named: string,
  identifiers: Map<number, { end: number; name: string }>,
  start: number,
): { names: string[]; isClause: boolean } | null {
  const names: string[] = []
  let isClause = false
  let p = start
  for (let first = true; ; first = false) {
    // 这一层的右括号就是子句的尽头：`(SELECT 1 SETTINGS a = 1)` 不能再往外收，
    // 免得 `SELECT * FROM (SELECT 1 SETTINGS a = 1) WHERE max_memory_usage = 0`
    // 把外面那个比较表达式也当成设置名收进来
    const boundary = skipTrivia(named, p, identifiers)
    if (boundary >= named.length || named[boundary] === ')') break

    const name = readSettingName(named, identifiers, p)
    if (!name) {
      // 这个位置不是标识符（字符串字面量、替换参数、别的标点）：ClickHouse 自己会判语法错误。
      // 跳过这个 token 继续收，免得中间一个怪名字把后面真正想拦的设置整段吃掉
      const quoted = identifiers.get(boundary)
      p = quoted ? quoted.end : boundary + 1
      continue
    }
    const assign = skipTrivia(named, name.end, identifiers)
    if (named[assign] !== '=') {
      // 名字后面不是 =，这一对不成立。收过真对之后才继续往后收：
      // 中间断掉的名字不能把后面 `max_memory_usage = 0` 一起带没了
      if (names.length === 0) break
      p = name.end
      continue
    }
    if (first) {
      isClause = !NOT_SETTING_NAME_WORDS.has(name.name.toUpperCase())
    }
    names.push(name.name)

    // 值取到这一层的下一个逗号（逗号是下一对的分隔符）。不能按空白断：
    // `{p:Map(String, String)}` 这类值里有空格，断早了会把后面真正想拦的设置名漏掉。
    // 括号与引用标识符整段跳过：`f(x, y)` 里的逗号、`SQL_a,b` 里的逗号都不是分隔符
    let q = assign + 1
    let depth = 0
    while (q < named.length) {
      const quoted = identifiers.get(q)
      if (quoted) {
        q = quoted.end
        continue
      }
      const ch = named[q]
      if (ch === '(' || ch === '[' || ch === '{') {
        depth++
      } else if (ch === ')' || ch === ']' || ch === '}') {
        // 已经出了 SETTINGS 子句所在的括号：`(SELECT 1 SETTINGS a = 1)` 到这里就该收手
        if (depth === 0) break
        depth--
      } else if (ch === ',' && depth === 0) {
        break
      }
      q++
    }
    if (named[q] !== ',') break
    p = q + 1
  }
  return names.length > 0 ? { names, isClause } : null
}

/** p 落在哪个引用标识符区间里（named 里真名可能带空格，判断 token 边界要先看区间） */
function spanContaining(
  identifiers: Map<number, { end: number; name: string }>,
  p: number,
): { start: number; end: number; name: string } | null {
  for (const [start, item] of identifiers) {
    if (start <= p && p < item.end) return { start, end: item.end, name: item.name }
  }
  return null
}

type IPrevToken = {
  kind: 'start' | 'word' | 'punct' | 'number' | 'literal'
  text: string
  quoted: boolean
  index: number
}

/**
 * index 前面那个真正参与语法的 token（跳过空白与注释）。用来判断当前词是
 * 「子句关键字」还是「表达式里的标识符 / 别名」——LIMIT / FORMAT / SETTINGS / UNION
 * 同时也是极常见的列名与别名，认错了不是把查询改坏就是漏掉行数上限。
 */
function prevToken(
  named: string,
  identifiers: Map<number, { end: number; name: string }>,
  index: number,
): IPrevToken {
  let p = index - 1
  while (p >= 0 && isWs(named[p]) && !spanContaining(identifiers, p)) p--
  if (p < 0) return { kind: 'start', text: '', quoted: false, index: -1 }

  const span = spanContaining(identifiers, p)
  if (span) return { kind: 'word', text: span.name, quoted: true, index: span.start }
  if (named[p] === HOLE) return { kind: 'literal', text: '', quoted: false, index: p }

  const end = p + 1
  while (p >= 0 && isWordChar(named[p]) && !spanContaining(identifiers, p)) p--
  const text = named.slice(p + 1, end)
  if (text) {
    return { kind: /^[0-9]/.test(text) ? 'number' : 'word', text, quoted: false, index: p + 1 }
  }
  return { kind: 'punct', text: named[p], quoted: false, index: p }
}

/** 这些词后面接的是表达式 / 别名，不是子句关键字（`ORDER BY limit`、`WHERE format > 1` 里的 limit 是列名） */
const CLAUSE_HEAD_WORDS = new Set([
  'SELECT', 'FROM', 'WHERE', 'PREWHERE', 'GROUP', 'BY', 'ORDER', 'HAVING', 'AS', 'ON', 'USING',
  'AND', 'OR', 'NOT', 'BETWEEN', 'WHEN', 'THEN', 'ELSE', 'LIKE', 'ILIKE', 'IN', 'IS',
  'JOIN', 'INNER', 'LEFT', 'RIGHT', 'FULL', 'CROSS', 'NATURAL', 'GLOBAL', 'ANY', 'ALL', 'ANTI', 'SEMI', 'LATERAL',
  'PARTITION', 'SAMPLE', 'WITH', 'OVER', 'WINDOW', 'RANGE', 'ROWS', 'LEADING', 'TRAILING', 'BOTH',
  'CAST', 'CASE', 'INTO', 'OUTFILE', 'SET', 'UPDATE', 'DELETE', 'TABLE', 'DATABASE', 'COLUMN',
  'DISTINCT', 'TOTALS', 'ROLLUP', 'CUBE', 'GROUPING', 'KEY', 'FINAL', 'PARALLEL',
])

/** 这些词既是子句关键字也是合法的列名 / 别名，光看前面不够，得再往前看一层（两次取反） */
const AMBIGUOUS_WORDS = new Set([
  'LIMIT', 'FORMAT', 'SETTINGS', 'ORDER', 'SELECT', 'OFFSET', 'PAGE', 'SORT', 'FILTER', 'FINAL',
  'UNION', 'INTERSECT', 'EXCEPT', 'SET', 'KEY', 'ALL', 'ROWS', 'RANGE', 'SAMPLE', 'TABLE',
])

/** 这些词自己就结束了一个表达式，后面再写名字是别名（`CASE … END update` 里的 update 是别名） */
const EXPRESSION_END_WORDS = new Set([
  'END', 'TOTALS', 'NULL', 'TRUE', 'FALSE', 'TIES', 'ROWS', 'FIRST', 'LAST', 'NULLS', 'ROLLUP', 'CUBE',
])

/**
 * index 处是不是「一个表达式已经结束、接下来可以写子句关键字」的位置。
 *
 * 后面三种取法都是反的：紧跟在 AS / WHERE / BY 这类词后面的是标识符，
 * 而紧跟在 AMBIGUOUS_WORDS 后面的词可能自己就是别名（`SELECT 1 AS limit LIMIT 5` 里
 * 第二个 LIMIT 前面的 limit 是别名，所以第二个 LIMIT 仍是子句）——所以要再往前取反一次。
 */
function isExpressionEnd(
  named: string,
  identifiers: Map<number, { end: number; name: string }>,
  index: number,
  guard = 0,
): boolean {
  const prev = prevToken(named, identifiers, index)
  if (prev.kind === 'start' || prev.kind === 'number' || prev.kind === 'literal') return true
  if (prev.kind === 'punct') return prev.text === ')' || prev.text === ']' || prev.text === '}' || prev.text === '*'
  const upper = prev.text.toUpperCase()
  if (EXPRESSION_END_WORDS.has(upper)) return true
  if (AMBIGUOUS_WORDS.has(upper)) {
    return guard < 4 ? !isExpressionEnd(named, identifiers, prev.index, guard + 1) : false
  }
  return !CLAUSE_HEAD_WORDS.has(upper)
}

/**
 * 这个 `)` 关的是不是 CTE 的函数体：`WITH x AS (SELECT 1) INSERT INTO …` 里的 INSERT
 * 实测会被 ClickHouse 解析成 INSERT（报的是缺 INSERT 权限），所以 CTE 体结束之后的位置
 * 必须当语句动词的位置看。
 */
function closesCteBody(
  named: string,
  identifiers: Map<number, { end: number; name: string }>,
  index: number,
): boolean {
  let depth = 0
  let p = index
  while (p >= 0) {
    const span = spanContaining(identifiers, p)
    if (span) {
      p = span.start - 1
      continue
    }
    const ch = named[p]
    if (ch === ')') {
      depth++
    } else if (ch === '(') {
      depth--
      if (depth === 0) {
        const before = prevToken(named, identifiers, p)
        return before.kind === 'word' && before.text.toUpperCase() === 'AS'
      }
    }
    p--
  }
  return false
}

/**
 * 当前位置能不能写语句动词（INSERT / DELETE / UPDATE / SET / ALTER …）。
 * 只有这几种位置才是：语句开头、分号之后、CTE 函数体的右括号之后、
 * 以及紧跟在一个普通标识符 / 表名之后（`ALTER TABLE t DELETE`、`SYSTEM FLUSH`）。
 *
 * 这样 `SELECT (1) delete FROM …`、`SELECT 1 set`、`j.update`、`SELECT insert, update FROM t`
 * 里的裸关键字都当标识符放过（实测 ClickHouse 这些写法都是合法的别名 / 列名），
 * 而 `WITH x AS (SELECT 1) INSERT INTO …` 这种真写语句照样拦得住。
 * 残留：`… END update` 这类靠 EXPRESSION_END_WORDS 放过，`SELECT (a) update FROM t` 靠 `)` 放过。
 */
function isStatementVerbPosition(
  named: string,
  identifiers: Map<number, { end: number; name: string }>,
  index: number,
): boolean {
  const prev = prevToken(named, identifiers, index)
  if (prev.kind === 'start') return true
  if (prev.kind === 'punct') {
    return prev.text === ')' && closesCteBody(named, identifiers, prev.index)
  }
  if (prev.kind === 'number' || prev.kind === 'literal' || prev.quoted) return false
  const upper = prev.text.toUpperCase()
  return !CLAUSE_HEAD_WORDS.has(upper) && !AMBIGUOUS_WORDS.has(upper) && !EXPRESSION_END_WORDS.has(upper)
}

/**
 * 当前位置是不是「表达式中间」——前面是运算符 / 括号 / 逗号 / 子句引导词，
 * 说明后面的词是表达式的一部分。
 *
 * 给 REPLACE INTO / REPLACE PARTITION / TRUNCATE TABLE 这类**两词**的语句形态用：
 * 它们跟 truncate(x, n)、replace(a, b, c) 这两个高频标量函数撞名，但函数调用是
 * `truncate(` 而不是 `truncate TABLE`，所以真正要放过的是
 * `SELECT truncate table FROM (SELECT 1 AS truncate)` 这种把它们当列名 / 别名的写法。
 * 比 isStatementVerbPosition 严：前面是数字 / 普通词 / `)` 就算语句位置
 * （`SELECT 1 REPLACE INTO t` 里 REPLACE 前面是 1，这种写法 ClickHouse 自己也解析不出来）。
 */
function isExpressionPosition(
  named: string,
  identifiers: Map<number, { end: number; name: string }>,
  index: number,
): boolean {
  const prev = prevToken(named, identifiers, index)
  if (prev.kind === 'start') return false
  if (prev.kind === 'punct') {
    return prev.text === '(' || prev.text === ',' || prev.text === '*'
      || (!/[A-Za-z0-9_$.`]/.test(prev.text) && prev.text !== ')' && prev.text !== ']')
  }
  if (prev.kind === 'number' || prev.kind === 'literal') return false
  const upper = prev.text.toUpperCase()
  return CLAUSE_HEAD_WORDS.has(upper) || AMBIGUOUS_WORDS.has(upper)
}

/**
 * 数字字面量的完整写法：ClickHouse 的 LIMIT 参数能写 `5e3`、`1_500`、`0x5DC`，
 * 只认 \d+ 会把它们读成 5 / 1 / 0，行数上限就算小了整整一个量级
 */
const NUMBER = '(?:0[xX][0-9a-fA-F][0-9a-fA-F_]*|[0-9][0-9_]*(?:\\.[0-9_]*)?(?:[eE][+-]?[0-9]+)?)'

function toCount(raw: string): number {
  const value = /^0[xX]/.test(raw)
    ? Number.parseInt(raw.replace(/_/g, ''), 16)
    : Number(raw.replace(/_/g, ''))
  // 超出安全整数时 Number 会变成 Infinity / 丢精度，统一按「大到没意义」处理：
  // 行数上限取不到就取最大值，绝不能把 `LIMIT 99999999999999999999` 读成一个非法的 LIMIT 字面量
  return Number.isFinite(value) ? Math.min(Math.floor(value), Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER
}

/**
 * 写完行数之后必须就结束，否则它不是 `LIMIT n` 子句：
 * `LIMIT 1 BY number` 是**按组**限行、`LIMIT 1 WITH TIES` 是并列全收，两者都没有全局上限；
 * `LIMIT 1 + 4999` 的行数是 5000 而不是 1。这三种都要走「包一层兜底限」的路子。
 */
const LIMIT_CLAUSE_TAIL = new RegExp(
  `^${WS_ANY}(?:$|[)\\],;]|(?:SETTINGS|FORMAT|UNION|INTERSECT|EXCEPT|INTO|PARALLEL)\\b)`, 'i')

/** 集合运算分支的开头：`EXCEPT (a)` 是星号修饰符，`EXCEPT (SELECT …)` 才是集合运算 */
const SET_OP_BRANCH = new RegExp(
  `^${WS_ANY}(?:(?:SELECT|WITH|ALL|DISTINCT|GLOBAL)\\b|\\(${WS_ANY}(?:\\(|SELECT|WITH))`, 'i')

function scanCode(
  code: string,
  named: string,
  identifiers: Map<number, { end: number; name: string }>,
): ICodeScan {
  const settingNames: string[] = []
  let topLevelLimit = false
  let topLevelSetOp = false
  let maxTopLevelLimit: number | null = null
  let limitClauseUnknown = false
  let limitInsertAt: number | null = null
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
      // 表达式当中的 limit 是列名 / 别名（`ORDER BY limit`、`WHERE limit > 3`、`SELECT a, limit FROM t`），
      // 认成子句不是漏掉行数上限就是把 LIMIT 插到列名前面把查询改坏
      if (!isExpressionEnd(named, identifiers, wordStart)) continue

      const rest = code.slice(end)
      // 三种写法里的行数都算上：LIMIT n / LIMIT offset, n / LIMIT n OFFSET m
      // （offset 与 count 谁是第二个数各版本说法不一，取最大值才不会把上限算小）
      const countMatch = new RegExp(`^${WS_ANY}(${NUMBER})(?:${WS_ANY},${WS_ANY}(${NUMBER}))?(?:${WS_ANY}OFFSET${WS_ANY}(${NUMBER}))?`, 'i').exec(rest)
      if (!countMatch) {
        // 后面是常量表达式（LIMIT toUInt64(5)、LIMIT {p:UInt8}、LIMIT -1、LIMIT 1 limit）
        // 时它是子句，只是行数定不下来，只能包一层兜底限
        limitClauseUnknown = true
        continue
      }
      for (let group = 1; group <= 3; group++) {
        const value = countMatch[group]
        if (value === undefined) continue
        maxTopLevelLimit = Math.max(maxTopLevelLimit ?? 0, toCount(value))
      }
      // `LIMIT 1 BY x` / `LIMIT 1 WITH TIES` / `LIMIT 1 + 4999` 都不是简单的 `LIMIT n`，
      // 行数上限要作用到整体上，走包一层的路子
      if (!LIMIT_CLAUSE_TAIL.test(rest.slice(countMatch[0].length))) {
        limitClauseUnknown = true
        continue
      }
      topLevelLimit = true
      continue
    }
    if (depth === 0 && SET_OPERATION_WORDS.has(word) && isExpressionEnd(named, identifiers, wordStart)) {
      // `SELECT * EXCEPT (secret) FROM t` 里的 EXCEPT 是星号修饰符不是集合运算：
      // 分支开头是 `SELECT` / `WITH` / `ALL` / `DISTINCT` / `GLOBAL`、或者包着查询的括号才算。
      // 误判成集合运算会把整条查询包一层再限行数，`* EXCEPT (…)` 里的列就被挡掉了
      const rest = code.slice(end)
      if (SET_OP_BRANCH.test(rest)) {
        topLevelSetOp = true
        continue
      }
    }
    // FORMAT 子句的写法是 `FORMAT <格式名>`，只出现在查询末尾（后面最多再跟 SETTINGS）。
    // 看名字后面是不是就结束了才认：`format('{}', x)` 是函数、`GROUP BY format ORDER BY x`
    // 里 format 是列名，认成子句会把 LIMIT 插到列名前面把查询改坏。
    // 格式名不当关键字看：`FORMAT Null` 是真格式名
    if (word === 'FORMAT') {
      if (!isExpressionEnd(named, identifiers, wordStart)) continue
      const name = readSettingName(named, identifiers, end)
      const after = name ? skipTrivia(named, name.end, identifiers) : named.length
      const isFormatClause = name !== null
        && (after >= named.length || new RegExp(`^${WS_ANY}(SETTINGS|FORMAT)\\b`, 'i').test(named.slice(after)))
      if (isFormatClause && depth === 0 && limitInsertAt === null) {
        limitInsertAt = wordStart
      }
      continue
    }

    if (word !== 'SETTINGS') continue
    if (!isExpressionEnd(named, identifiers, wordStart)) continue
    // SETTINGS 子句的写法固定是 `SETTINGS 名字 = 值[, 名字 = 值…]`。名字除了普通标识符还能写成
    // 反引号 / 双引号标识符（`SETTINGS \`readonly\` = 0` 是合法写法），所以按 named 解析——
    // 只看 code 会把引号里的名字当成空白整段漏掉。`SELECT user_id, settings FROM users`
    // 里的 settings 是列名，认成子句会让 LIMIT 被插到列名前面
    const clause = readSettingsClause(named, identifiers, end)
    if (!clause) continue

    // 只有真正的 SETTINGS 子句才能把 LIMIT 插到它前面（LIMIT 写在 SETTINGS 后面是语法错误）。
    // 关键词打头的 `… ELSE settings END = 1` 不是子句，但名字照样收进来查——
    // 多收的名字最多让我们拒绝得多一点，方向是拒绝不是放过
    if (clause.isClause && depth === 0 && limitInsertAt === null) {
      limitInsertAt = wordStart
    }
    // SETTINGS 子句里的设置名：嵌套位置（CTE 体、派生表）同样要查，只看最后一个会漏
    settingNames.push(...clause.names)
  }

  return { topLevelLimit, topLevelSetOp, maxTopLevelLimit, limitClauseUnknown, limitInsertAt, settingNames }
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
      if (isForbiddenLiteralSetting(match[2])) {
        findings.push(`不允许在查询参数里修改设置：${match[2]}`)
      }
    }
  }
  return findings
}

/** named 里字面量（HOLE 段）的区间，按下标对齐到 literals */
function collectHoleRuns(named: string): Array<{ start: number; end: number; index: number }> {
  const runs: Array<{ start: number; end: number; index: number }> = []
  let index = 0
  for (let i = 0; i < named.length; i++) {
    if (named[i] !== HOLE) continue
    const start = i
    while (i < named.length && named[i] === HOLE) i++
    runs.push({ start, end: i, index: index++ })
    i--
  }
  return runs
}

/**
 * 两参 `(库名, 表名)` 的表函数调用：`timeSeriesTags('system', 'query_log')` 实测把两个字符串
 * 拼成 system.query_log 去解析，还回显了引擎与表 UUID，而逐个字面量看是
 * `system` 与 `query_log` 两个普通字符串，`system.` 的规则一个都命中不了。
 * 所以把同一层相邻的两个字面量拼成 `库.表` 再按 system 规则判一次。
 *
 * 只看 FROM / JOIN 后面的调用：`IN ('system', 'x')`、`array('system','x')`、`map('system','x')`
 * 都是普通参数表，拼起来没有意义，扫了就是纯误伤。
 * 已知残留：逗号连接写法 `FROM t, merge('system','query_log')` 不在 FROM/JOIN 调用里——
 * 但 merge( 本身已经被函数名规则整只拦掉了。
 */
function collectJoinedLiteralFindings(
  named: string,
  identifiers: Map<number, { end: number; name: string }>,
  literals: string[],
): string[] {
  const findings: string[] = []
  const runs = collectHoleRuns(named)
  const callPattern = new RegExp(
    `(?:^|[^A-Za-z0-9_$])(?:FROM|JOIN)${WS_ANY}[^A-Za-z0-9_$]+([A-Za-z0-9_$]+)${WS_ANY}\\(`, 'gi')
  let call: RegExpExecArray | null
  while ((call = callPattern.exec(named)) !== null) {
    const open = callPattern.lastIndex - 1
    // 只收这一层（括号深度 1）的字面量，嵌套括号里的参数表不参与拼接
    let depth = 1
    let q = open + 1
    let prev: { end: number; index: number } | null = null
    while (q < named.length && depth > 0) {
      const quoted = identifiers.get(q)
      if (quoted) {
        q = quoted.end
        continue
      }
      const ch = named[q]
      if (ch === '(' || ch === '[' || ch === '{') {
        depth++
        q++
        continue
      }
      if (ch === ')' || ch === ']' || ch === '}') {
        depth--
        q++
        continue
      }
      if (ch === HOLE) {
        const run = runs.find(item => item.start === q)
        if (run && depth === 1) {
          if (prev && new RegExp(`^${WS_ANY},${WS_ANY}$`).test(named.slice(prev.end, run.start))) {
            SYSTEM_REF_PATTERN.lastIndex = 0
            const joined = `${literals[prev.index]}.${literals[run.index]}`
            const match = SYSTEM_REF_PATTERN.exec(joined)
            if (match && !SYSTEM_TABLE_WHITELIST.has(match[1].toLowerCase())) {
              findings.push(`不允许在查询参数里指定 system.${match[1]}`)
            }
          }
          prev = { end: run.end, index: run.index }
          q = run.end
          continue
        }
        while (q < named.length && named[q] === HOLE) q++
        continue
      }
      q++
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
    if (!sql || trimSql(sql) === '') {
      throw new BusinessException('SQL 语句不能为空')
    }

    // 判定看掩码后的部分，原文只用来做最终返回
    let trimmed = trimSql(sql)
    let endOfCode: number
    const masked = maskSqlLiterals(trimmed)
    const { code, refs, named, identifiers, literals } = masked
    endOfCode = masked.endOfCode
    const codeOnly = trimSql(code)

    if (codeOnly === '') {
      throw new BusinessException('SQL 语句不能为空')
    }

    // 必须以 SELECT 或 WITH 开头（集合运算的分支允许写成 (SELECT …)，见 ClickHouse UNION 文档）
    if (!new RegExp(`^\\(*${WS_ANY}(SELECT|WITH)\\b`, 'i').test(codeOnly)) {
      throw new BusinessException('仅支持 SELECT / WITH 开头的查询语句')
    }

    // 分号：只允许整条查询末尾的一个。DBeaver / DataGrip / 文档里拷出来的语句几乎都带结尾分号，
    // 一律拒掉太难受；而中间出现或者后面还有代码就是多语句。
    // 按掩码后的 code 找位置：字面量里的 `'a; b'` 不算（原文下标与 code 对齐）。
    // 找到之后要把原文里的分号摘掉，否则追加的 ` LIMIT 1000` 会变成第二条语句
    const lastSemi = code.lastIndexOf(';')
    if (lastSemi !== -1) {
      const sole = code.indexOf(';') === lastSemi && trimSql(code.slice(lastSemi + 1)) === ''
      if (!sole) {
        throw new BusinessException('不允许包含多条语句（分号）')
      }
      trimmed = trimmed.slice(0, lastSemi) + trimmed.slice(lastSemi + 1)
      endOfCode = Math.min(endOfCode, lastSemi)
    }

    // 拒绝写操作关键字（按词边界匹配，SYSTEM 后紧跟 . 时为 system 数据库前缀，交给下面的表规则）。
    // 只在**语句动词的位置**才算数：`SELECT (1) delete`、`SELECT 1 set`、`j.update`、
    // `SELECT insert, update, delete FROM t` 里的裸关键字都是合法的列名 / 别名，
    // 实测 ClickHouse 这些写法全都 200，一律拒掉会把正经分析查询挡在门外
    const forbiddenPattern = new RegExp(
      `\\b(${FORBIDDEN_KEYWORDS.map(keyword => keyword === 'SYSTEM' ? `SYSTEM(?!${WS_ANY}\\.)` : keyword).join('|')})\\b`, 'ig')
    let forbiddenMatch: RegExpExecArray | null
    while ((forbiddenMatch = forbiddenPattern.exec(code)) !== null) {
      // EXPLAIN 不看位置：它可以当表表达式用（`SELECT * FROM (EXPLAIN AST …)`），
      // 而 viewExplain 的 settings 参数是字符串字面量，能绕开下面的设置名检查。
      // 其余关键字只在语句动词的位置才算数：`SELECT (1) delete`、`SELECT 1 set`、`j.update`、
      // `SELECT insert, update, delete FROM t` 里的裸关键字都是合法的列名 / 别名，
      // 实测 ClickHouse 这些写法全都 200，一律拒掉会把正经分析查询挡在门外
      const keyword = forbiddenMatch[1].toUpperCase()
      if (keyword === 'EXPLAIN' || isStatementVerbPosition(named, identifiers, forbiddenMatch.index)) {
        throw new BusinessException(`不允许使用关键字：${keyword}，仅支持只读查询`)
      }
    }

    // 拒绝 REPLACE INTO / REPLACE PARTITION / TRUNCATE TABLE（这几个词本身是合法标量函数名，不能按关键字拦）
    for (const [pattern, label] of FORBIDDEN_STATEMENTS) {
      const statement = new RegExp(pattern.source, 'ig').exec(code)
      if (statement && !isExpressionPosition(named, identifiers, statement.index)) {
        throw new BusinessException(`不允许使用 ${label}，仅支持只读查询`)
      }
    }

    // 拒绝 INTO OUTFILE（ClickHouse 服务端写文件）。
    // ClickHouse 的语法要求文件名是字符串字面量（`SELECT 1 INTO OUTFILE` 报 Expected string literal），
    // 所以后面接的是字面量 / 引号 / 替换参数才算数：`SELECT into outfile FROM (SELECT 1 AS into)` 里的
    // into outfile 是两个别名，实测 200
    const intoOutfile = new RegExp(`INTO${WS_ANY}OUTFILE${WS_ANY}([${HOLE}'"\x60{])`, 'i')
    if (intoOutfile.test(named)) {
      throw new BusinessException('不允许使用 INTO OUTFILE，仅支持只读查询')
    }

    // 拦只读也能干坏事的表函数 / 函数：出网、读服务器文件、跨实例查库、命令执行
    const call = findForbiddenCall(refs)
    if (call) {
      throw new BusinessException(`不允许使用函数：${call}，仅支持只读查询`)
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
    const scan = scanCode(code, named, identifiers)
    const forbiddenSetting = scan.settingNames.find(isForbiddenSetting)
    if (forbiddenSetting) {
      throw new BusinessException(`不允许在查询中修改设置：${forbiddenSetting}`)
    }

    // 字面量内容单独再扫一遍：库表名与设置名会被当作参数传进表函数，
    // 例如 remote('h:9000', 'system', 'query_log')、viewExplain('AST', 'readonly = 0', …)
    const literalFinding = collectLiteralFindings(literals)[0]
      ?? collectJoinedLiteralFindings(named, identifiers, literals)[0]
    if (literalFinding) {
      throw new BusinessException(literalFinding)
    }

    // 集合运算（UNION / INTERSECT / EXCEPT）的行数上限要作用在整体上：
    // ClickHouse 的 LIMIT / ORDER BY 是跟着各个分支的，直接在末尾追加 LIMIT 只会限住最后一个分支
    // （总量照样没上限），还会把最后一个分支自己的 LIMIT 顶掉。所以整体包一层再限行数，
    // 分支里的 LIMIT / ORDER BY 原样留在内层。普通查询不这么做：外层 SELECT 可能丢掉内层 ORDER BY 的顺序。
    // 顶层 LIMIT 写的是常量表达式、行数定不下来时同理：再追加一个 LIMIT 只会变成语法错误。
    // 整条查询被括号包住时也要走这条路：`(SELECT …) LIMIT n` 是语法错误
    // （实测报 Expected one of: UNION, EXCEPT, INTERSECT, INTO OUTFILE, FORMAT, SETTINGS），
    // 而 `SELECT * FROM ((SELECT …)) LIMIT 1000` 是合法的
    const parenthesized = /^\(/.test(codeOnly)
    if (scan.topLevelSetOp || scan.limitClauseUnknown || parenthesized) {
      const cap = Math.max(1000, scan.maxTopLevelLimit ?? 0)
      // 尾部的 FORMAT / SETTINGS 子句要留在包一层的**外面**：FORMAT 不能写在子查询里
      // （实测 `SELECT * FROM (SELECT 2 AS a FORMAT TSV) LIMIT 5` 报 Code: 62）
      const cut = scan.limitInsertAt ?? endOfCode
      const body = trimSql(trimmed.slice(0, cut))
      const tail = trimSql(trimmed.slice(cut))
      // 右括号要紧贴 body 的最后一行：body 以行注释收尾时直接拼 `)` 会掉进注释里
      // （`… -- 注释)` 整段都变成注释，行数上限与尾部子句一起没了）
      const newline = /\r\n|\r|\n/.exec(trimmed.slice(body.length, cut))?.[0] ?? ''
      const wrapped = `SELECT * FROM (${body}${newline}) LIMIT ${cap}`
      return tail ? `${wrapped} ${tail}` : wrapped
    }

    // 无顶层 LIMIT 时自动追加 LIMIT 1000
    // 插在顶层尾部子句（FORMAT / SETTINGS）之前（LIMIT 在它们前面才是合法顺序），
    // 插在最后一段代码之后（否则会被行注释吃掉）
    // 只认顶层 LIMIT：子查询里的 LIMIT 不算，否则整条查询就没有行数上限了
    if (!scan.topLevelLimit) {
      const insertAt = scan.limitInsertAt ?? endOfCode
      const head = trimSql(trimmed.slice(0, insertAt))
      const tail = trimSql(trimmed.slice(insertAt))
      // 分隔符必须跟 head 的行注释错开一行：`… -- 注释 LIMIT 1000` 里 LIMIT 会被注释吃掉，
      // 整条查询的行数上限就没了（实测 2000 行一条不落全回来了）
      const newline = /\r\n|\r|\n/.exec(trimmed.slice(head.length, insertAt))?.[0]
      const sep = newline ?? ' '
      return tail ? `${head}${sep}LIMIT 1000${sep}${tail}` : `${head}${sep}LIMIT 1000`
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
        // max_ 前缀的资源设置整体在禁止修改名单里，查询里的 SETTINGS 覆盖不掉这个值
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
