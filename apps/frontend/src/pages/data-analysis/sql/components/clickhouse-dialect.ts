import type { Completion } from "@codemirror/autocomplete"
import { SQLDialect } from "@codemirror/lang-sql"

/**
 * ClickHouse SQL 方言
 *
 * SQLDialect.define 的 keywords / types / builtin 会按 `word.toLowerCase()` 建索引，
 * 同名词条后写的分组覆盖先写的（keywords < types < builtin）。
 * 所以这里按 ClickHouse 官方大小写书写，派生出小写串喂给解析器，
 * 再用 CANONICAL 把补全标签还原回来。
 */

// 小写 -> 规范写法，用于还原补全标签
const CANONICAL = new Map<string, string>()

function register(words: string[]): string {
  return words
    .map(word => {
      CANONICAL.set(word.toLowerCase(), word)
      return word.toLowerCase()
    })
    .join(' ')
}

/**
 * SQL 语法关键字（补全时大写展示）。
 * 函数名放 CLICKHOUSE_FUNCTIONS，类型名放 CLICKHOUSE_TYPES。
 * true/false/null/unknown 由解析器内置，写进来会被降级成普通关键字。
 */
const CLICKHOUSE_KEYWORDS = [
  'ALL', 'ALTER', 'AND', 'ANTI', 'ANY', 'AS', 'ASC', 'ASCENDING', 'ASOF',
  'BETWEEN', 'BOTH', 'BY',
  'CASE', 'CAST', 'CHECK', 'CLEAR', 'COLLATE', 'COLUMN', 'COLUMNS', 'COMMENT', 'COMMIT',
  'CONSTRAINT', 'CREATE', 'CROSS', 'CUBE', 'CURRENT_DATE', 'CURRENT_TIME', 'CURRENT_TIMESTAMP',
  'DATABASE', 'DATABASES', 'DAY', 'DEDUPLICATE', 'DEFAULT', 'DELETE', 'DESC', 'DESCENDING',
  'DESCRIBE', 'DETACH', 'DICTIONARIES', 'DISK', 'DISTINCT', 'DISTRIBUTED', 'DROP',
  'ELSE', 'END', 'ENGINE', 'ENUM', 'EXCEPT', 'EXISTS', 'EXPLAIN', 'EXPRESSION', 'EXTRACT',
  'FETCHES', 'FINAL', 'FIRST', 'FLUSH', 'FOLLOWING', 'FOR', 'FORMAT', 'FROM', 'FULL', 'FUNCTION',
  'GLOBAL', 'GRANT', 'GRANULARITY', 'GROUP', 'GROUPING',
  'HAVING', 'HIERARCHICAL', 'HOUR',
  'ID', 'ILIKE', 'IN', 'INDEX', 'INJECTIVE', 'INNER', 'INTERSECT', 'INTERVAL',
  'INTO', 'IS', 'IS_OBJECT_ID',
  'JOIN', 'JSON_FALSE', 'JSON_TRUE',
  'KEY', 'KILL',
  'LAST', 'LATERAL', 'LEFT', 'LIFETIME', 'LIKE', 'LIMIT', 'LIVE', 'LOCAL', 'LOGS',
  'MATERIALIZED', 'MERGES', 'MINUTE', 'MODIFY', 'MONTH', 'MOVE', 'MUTATION',
  'NO', 'NOT', 'NULLS',
  'OFFSET', 'ON', 'OPTIMIZE', 'OR', 'ORDER', 'OUTER', 'OUTFILE', 'OVER',
  'PARTITION', 'POPULATE', 'PRECEDING', 'PREWHERE', 'PRIMARY', 'PROJECTION',
  'QUARTER',
  'RELOAD', 'REMOVE', 'RENAME', 'REPLACE', 'REPLICA', 'REVOKE', 'RIGHT', 'ROLLUP',
  'ROW', 'ROWS',
  'SAMPLE', 'SECOND', 'SELECT', 'SEMI', 'SETTINGS', 'SHOW', 'SOURCE', 'START', 'STOP', 'SYNC',
  'SYNTAX', 'SYSTEM',
  'TABLE', 'TABLES', 'TEMPORARY', 'TEST', 'THEN', 'TIES', 'TIME', 'TIMEOUT', 'TIMESTAMP', 'TO',
  'TOTAL', 'TOTALS', 'TRAILING', 'TRIM', 'TRUNCATE',
  'UNBOUNDED', 'UNION', 'UPDATE', 'USE', 'USING',
  'VALUES', 'VIEW',
  'WATCH', 'WEEK', 'WHEN', 'WHERE', 'WINDOW', 'WITH',
  'YEAR',
]

/**
 * 内置函数（补全时还原成 ClickHouse 官方大小写）。
 * 与关键字同名的语法词（like/ilike/left/right/trim/format/values/view/any）不放这里，
 * 否则会盖掉关键字分组；与类型同名的（array/map/tuple）同理。
 */
const CLICKHOUSE_FUNCTIONS = [
  // 聚合（含常用 -If 组合）
  'anyHeavy', 'anyLast', 'anyLastIf', 'argAny', 'argMax', 'argMin', 'avg', 'avgIf', 'avgMap',
  'corr', 'count', 'countIf', 'covarPop', 'covarSamp', 'entropy', 'groupArray', 'groupArrayLast',
  'groupArrayMovingAvg', 'groupArrayMovingSum', 'groupArraySample', 'groupBitAnd', 'groupBitmap',
  'groupBitOr', 'groupBitXor', 'groupUniqArray', 'histogram', 'kurtPop', 'kurtSamp', 'max', 'maxIf',
  'maxMap', 'median', 'medianIf', 'min', 'minIf', 'minMap', 'mode', 'quantile',
  'quantileDeterministic', 'quantileExact', 'quantileExactIf', 'quantileExactWeighted', 'quantiles',
  'quantileTiming', 'quantileTimingIf', 'retention', 'sequenceCount', 'sequenceMatch',
  'sequenceNextNode', 'simpleLinearRegression', 'skewPop', 'skewSamp', 'stddevPop', 'stddevSamp',
  'sum', 'sumIf', 'sumKahan', 'sumMap', 'sumWithOverflow', 'topK', 'topKWeighted', 'uniq',
  'uniqCombined', 'uniqExact', 'uniqExactIf', 'uniqHLL12', 'uniqIf', 'uniqUpTo', 'varPop', 'varSamp',
  'windowFunnel',
  // 数学
  'abs', 'acos', 'asin', 'atan', 'atan2', 'cbrt', 'ceil', 'ceiling', 'cos', 'cosh', 'degrees', 'erf',
  'erfc', 'exp', 'exp2', 'exp10', 'factorial', 'floor', 'gcd', 'intExp2', 'intExp10', 'lcm',
  'lgamma', 'ln', 'log', 'log2', 'log10', 'log1p', 'pow', 'power', 'radians', 'round', 'roundAge',
  'roundBankers', 'roundDuration', 'roundToExp2', 'sign', 'sin', 'sinh', 'sqrt', 'tan', 'tanh',
  'tgamma', 'trunc',
  // 类型转换
  'accurateCastOrNull', 'accurateCastOrZero', 'assumeNotNull', 'reinterpretAsDate',
  'reinterpretAsDateTime', 'reinterpretAsFixedString', 'reinterpretAsFloat32', 'reinterpretAsFloat64',
  'reinterpretAsInt8', 'reinterpretAsInt16', 'reinterpretAsInt32', 'reinterpretAsInt64',
  'reinterpretAsIPv4', 'reinterpretAsIPv6', 'reinterpretAsString', 'reinterpretAsUUID', 'toBool',
  'toColumnTypeName', 'toDate', 'toDate32', 'toDateTime', 'toDateTime64', 'toDecimal', 'toDecimal32',
  'toDecimal64', 'toDecimal128', 'toDecimal256', 'toFixedString', 'toFloat32', 'toFloat64',
  'toInt8', 'toInt16', 'toInt32', 'toInt64', 'toInt128', 'toInt256', 'toIntervalDay',
  'toIntervalHour', 'toIntervalMinute', 'toIntervalMonth', 'toIntervalQuarter', 'toIntervalSecond',
  'toIntervalWeek', 'toIntervalYear', 'toIPv4', 'toIPv4OrNull', 'toIPv6', 'toIPv6OrNull',
  'toISOString', 'toLowCardinality', 'toNullable', 'toString', 'toTypeName', 'toUInt8', 'toUInt16',
  'toUInt32', 'toUInt64', 'toUInt128', 'toUInt256', 'toUUID',
  // 日期时间
  'addDays', 'addHours', 'addMinutes', 'addMonths', 'addQuarters', 'addSeconds', 'addWeeks',
  'addYears', 'dateAdd', 'dateDiff', 'dateSub', 'dateTrunc', 'formatDateTime', 'fromUnixTimestamp',
  'now', 'parseDateTimeBestEffort', 'parseDateTimeBestEffortOrNull', 'parseDateTimeBestEffortOrZero',
  'subtractDays', 'subtractHours', 'subtractMinutes', 'subtractMonths', 'subtractQuarters',
  'subtractSeconds', 'subtractWeeks', 'subtractYears', 'timeSlots', 'today', 'toDayOfMonth',
  'toDayOfWeek', 'toDayOfYear', 'toHour', 'toISOWeek', 'toMicrosecond', 'toMillisecond', 'toMinute',
  'toMonth', 'toNanosecond', 'toQuarter', 'toRelativeDayNum', 'toRelativeHourNum',
  'toRelativeMinuteNum', 'toRelativeMonthNum', 'toRelativeQuarterNum', 'toRelativeSecondNum',
  'toRelativeWeekNum', 'toRelativeYearNum', 'toSecond', 'toStartOfDay', 'toStartOfFifteenMinutes',
  'toStartOfFiveMinute', 'toStartOfHour', 'toStartOfInterval', 'toStartOfISOYear', 'toStartOfMinute',
  'toStartOfMonth', 'toStartOfQuarter', 'toStartOfTenMinutes', 'toStartOfWeek', 'toStartOfYear',
  'toTime', 'toTimeZone', 'toTimeSlot', 'toUnixTimestamp', 'toYear', 'toYYYYMM', 'toYYYYMMDD',
  'toYYYYMMDDhhmmss', 'yesterday',
  // 字符串
  'appendTrailingCharIfAbsent', 'arrayStringConcat', 'base64Decode', 'base64Encode', 'charLength',
  'characterLength', 'concat', 'concatAssumeInjective', 'concatWithSeparator', 'convertCharset',
  'countMatches', 'countSubstrings', 'countSubstringsCaseInsensitive', 'cutQueryStringAndFragment',
  'cutToFirstSignificantSubdomain', 'decodeURLComponent', 'domain', 'domainWithoutWWW', 'empty',
  'encodeURLComponent', 'endsWith', 'extractAll', 'extractAllGroupsHorizontal',
  'extractAllGroupsVertical', 'extractURLParameter', 'extractURLParameterName', 'extractURLParameters',
  'firstSignificantSubdomain', 'hex', 'leftPad', 'leftPadUTF8', 'leftUTF8', 'length', 'lengthUTF8',
  'lower', 'lowerUTF8', 'ltrim', 'match', 'multiFuzzyMatchAny', 'multiFuzzyMatchAnyUTF8',
  'multiMatchAny', 'multiMatchAnyUTF8', 'multiSearchAny', 'multiSearchAnyUTF8',
  'multiSearchFirstIndex', 'multiSearchFirstIndexUTF8', 'multiSearchFirstPosition',
  'multiSearchFirstPositionUTF8', 'netloc', 'normalizeQuery', 'normalizedQueryHash', 'notILike',
  'notLike', 'ngramDistance', 'ngramSearch', 'path', 'position', 'positionCaseInsensitive',
  'positionCaseInsensitiveUTF8', 'positionUTF8', 'printf', 'protocol', 'queryString',
  'queryStringAndFragment', 'regexpExtract', 'repeat', 'replaceAll', 'replaceOne', 'replaceRegexpAll',
  'replaceRegexpOne', 'reverse', 'reverseUTF8', 'rightPad', 'rightPadUTF8', 'rightUTF8', 'rtrim',
  'splitByChar', 'splitByNonAlpha', 'splitByRegexp', 'splitByString', 'splitByWhitespace',
  'startsWith', 'substring', 'substringUTF8', 'toStringCutToZero', 'topLevelDomain', 'toValidUTF8',
  'trimBoth', 'trimLeft', 'trimRight', 'tryBase64Decode', 'unhex', 'upper', 'upperUTF8',
  'UUIDNumToString', 'UUIDStringToNum', 'visitParamHas',
  // 条件 / 通用
  'coalesce', 'greatest', 'if', 'ifInf', 'ifNaN', 'ifNotFinite', 'ifNull', 'isFinite', 'isInfinite',
  'isNaN', 'isNotNull', 'isNull', 'least', 'multiIf', 'nullIf', 'transform', 'visibleWidth',
  'zeroIfNull',
  // 数组
  'arrayAll', 'arrayCompact', 'arrayConcat', 'arrayCount', 'arrayCumSum', 'arrayDifference',
  'arrayDistinct', 'arrayDotProduct', 'arrayElement', 'arrayElementOrNull', 'arrayEnumerate',
  'arrayEnumerateUniq', 'arrayEnumerateUniqDense', 'arrayExists', 'arrayFill', 'arrayFilter',
  'arrayFirst', 'arrayFirstIndex', 'arrayFirstOrNull', 'arrayFlatten', 'arrayFold', 'arrayGroup',
  'arrayHasAll', 'arrayHasAny', 'arrayIndex', 'arrayIntersect', 'arrayJoin', 'arrayLast',
  'arrayLastIndex', 'arrayMap', 'arrayPopBack', 'arrayPopFront', 'arrayPushBack', 'arrayPushFront',
  'arrayRandomSample', 'arrayReduce', 'arrayReduceInRanges', 'arrayResize', 'arrayReverse',
  'arrayReverseFill', 'arrayReverseSort', 'arrayRotateLeft', 'arrayRotateRight', 'arrayShiftLeft',
  'arrayShiftRight', 'arraySlice', 'arraySort', 'arraySum', 'arrayUniq', 'arrayZip', 'arrayZipUnaligned',
  'emptyArrayDate', 'emptyArrayDateTime', 'emptyArrayFloat32', 'emptyArrayFloat64', 'emptyArrayInt8',
  'emptyArrayInt16', 'emptyArrayInt32', 'emptyArrayInt64', 'emptyArrayUInt8', 'emptyArrayUInt16',
  'emptyArrayUInt32', 'emptyArrayUInt64', 'has', 'hasAll', 'hasAllIndices', 'hasAny', 'hasSubstr',
  'indexOf', 'range',
  // Map / 元组
  'mapAdd', 'mapConcat', 'mapContains', 'mapElement', 'mapExtract', 'mapFilter', 'mapKeys',
  'mapUpdate', 'mapValues', 'namedTuple', 'tupleElement', 'tupleToNamedTuple',
  // JSON
  'JSONContains', 'JSONExtract', 'JSONExtractArrayRaw', 'JSONExtractBool', 'JSONExtractFloat',
  'JSONExtractInt', 'JSONExtractKeys', 'JSONExtractKeysAndValues', 'JSONExtractRaw',
  'JSONExtractString', 'JSONExtractUInt', 'JSONHas', 'JSONLength', 'JSONType', 'JSONValid',
  'toJSONString', 'visitParamExtractBool', 'visitParamExtractFloat', 'visitParamExtractInt',
  'visitParamExtractRaw', 'visitParamExtractString', 'visitParamExtractUInt',
  // 位运算 / 哈希 / 编码
  'bitAnd', 'bitCount', 'bitMaskToList', 'bitMaskToArray', 'bitNot', 'bitOr', 'bitShiftLeft',
  'bitShiftLeftU64', 'bitShiftRight', 'bitShiftRightU64', 'bitXor', 'BLAKE3', 'byteSwap', 'cityHash64',
  'farmFingerprint', 'farmHash64', 'hiveHash', 'intHash32', 'intHash64', 'javaHash', 'javaHashHive',
  'jumpConsistentHash', 'MD5', 'metroHash64', 'murmurHash2_32', 'murmurHash2_64', 'murmurHash3_32',
  'murmurHash3_64', 'murmurHash3_128', 'SHA1', 'SHA256', 'SHA512', 'sipHash64', 'sipHash128',
  'wyHash64',
  // 网络 / IP / 地理
  'geoHashDecode', 'geoHashEncode', 'geoHashesInBox', 'greatCircleAngle', 'greatCircleDistance',
  'IPv4ApplyMask', 'IPv4MaskLastRemapZero', 'IPv4NumToString', 'IPv4StringToNum', 'IPv4ToIPv6',
  'IPv4ToNum', 'IPv6ApplyMask', 'IPv6NumToString', 'IPv6StringToNum', 'IPv6ToIPv4', 'IPv6ToNum',
  'isIPv4String', 'isIPv6String',
  // 其它
  'bar', 'buildId', 'filesystemAvailable', 'filesystemCapacity', 'filesystemFree', 'fuzzBits',
  'initialQueryId', 'isDecimal', 'YandexContainerErrorCode', 'yandexRUMEnable',
  // 表函数
  'azureBlobStorage', 'cluster', 'clusterAllReplicas', 'clusterEach', 'deltaLake', 'dictionary',
  'executable', 'executablePool', 'file', 'generateRandom', 'hdfs', 'hudi', 'iceberg', 'input',
  'jdbc', 'loop', 'meilisearch', 'merge', 'mongodb', 'mysql', 'nats', 'numbers', 'numbersMT',
  'odbc', 'postgresql', 'rabbitmq', 'redis', 'remote', 'remoteSecure', 'replicate', 's3', 's3Cluster',
  'sqlite', 'url', 'windowView', 'zeroMT', 'zeros',
]

/**
 * ClickHouse 数据类型
 */
const CLICKHOUSE_TYPES = [
  'AggregateFunction', 'Array', 'BFloat16', 'Bool', 'Date', 'Date32', 'DateTime', 'DateTime64',
  'Decimal', 'Decimal32', 'Decimal64', 'Decimal128', 'Decimal256', 'Dynamic', 'Enum8', 'Enum16',
  'FixedString', 'Float32', 'Float64', 'Int8', 'Int16', 'Int32', 'Int64', 'Int128', 'Int256',
  'IntervalDay', 'IntervalHour', 'IntervalMinute', 'IntervalMonth', 'IntervalQuarter',
  'IntervalSecond', 'IntervalWeek', 'IntervalYear', 'IPv4', 'IPv6', 'JSON', 'LowCardinality', 'Map',
  'MultiPolygon', 'Nested', 'Nothing', 'Nullable', 'Object', 'Point', 'Polygon', 'Ring',
  'SimpleAggregateFunction', 'String', 'Tuple', 'UInt8', 'UInt16', 'UInt32', 'UInt64', 'UInt128',
  'UInt256', 'UUID', 'Variant',
]

// 解析器内置的字面量，补全时单独归类
const CLICKHOUSE_CONSTANTS = new Set(['true', 'false', 'null', 'unknown'])

/**
 * 补全项：关键字大写展示，函数与类型还原成 ClickHouse 官方大小写
 */
function buildClickhouseCompletion(label: string, type: string): Completion {
  if (type === 'keyword') {
    return { label: label.toUpperCase(), type: 'keyword', detail: '关键字', boost: -1 }
  }
  if (type === 'type') {
    return { label: CANONICAL.get(label) ?? label, type: 'type', detail: '类型', boost: -1 }
  }
  if (CLICKHOUSE_CONSTANTS.has(label)) {
    return { label: label.toUpperCase(), type: 'constant', detail: '常量', boost: -1 }
  }
  // 剩下的都是 builtin 里的函数
  return { label: CANONICAL.get(label) ?? label, type: 'function', detail: '函数', boost: -1 }
}

/**
 * ClickHouse SQL 方言
 */
export const ClickHouseSQL = SQLDialect.define({
  // 反引号与双引号都能引用标识符（$ 开头的埋点列必须用反引号）
  identifierQuotes: '`"',
  // 单引号是字符串，双引号留给标识符
  backslashEscapes: true,
  doubleQuotedStrings: false,
  // ClickHouse 支持 # 与 // 行注释
  hashComments: true,
  slashComments: true,
  // ClickHouse 用 {name:Type} 做查询参数，不需要 ? 前缀变量
  specialVar: '',
  operatorChars: '*+-/%<>!=&|~^?',
  keywords: register(CLICKHOUSE_KEYWORDS),
  types: register(CLICKHOUSE_TYPES),
  builtin: register(CLICKHOUSE_FUNCTIONS),
})

/**
 * sql() 的 ClickHouse 配置：方言 + 关键字/函数/类型补全
 */
export const clickhouseSqlConfig = {
  dialect: ClickHouseSQL,
  upperCaseKeywords: false,
  keywordCompletion: buildClickhouseCompletion,
}
