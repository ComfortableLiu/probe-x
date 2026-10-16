const assert = require('node:assert/strict')
const { test } = require('node:test')
const { formatQueryParams } = require('@clickhouse/client-common')
require('ts-node').register({ transpileOnly: true, skipProject: true, compilerOptions: {
  target: 'ES2022', module: 'CommonJS', moduleResolution: 'node', esModuleInterop: true,
} })
const { readCleaningBacklogPage } = require('../apps/data-dashboard-api-service/src/api/compute-node/cleaning-backlog-reader.ts')

const RANGE = { runDate: '2026-10-15', throughDate: '2026-10-14' }
const keyOf = row => JSON.stringify([row.date, row.session_id])
const sourceRow = (date, time, sessionId, eventName = 'click') => ({
  service_time: `${date} ${time}`, session_id: sessionId, event_name: eventName, date,
})
const compareKeys = (a, b) => {
  for (const field of ['service_time', 'session_id', 'event_name']) {
    const comparison = Buffer.compare(Buffer.from(a[field]), Buffer.from(b[field]))
    if (comparison !== 0) return comparison
  }
  return 0
}

/** SQL IO 桩只模拟源表排序/范围和本页查重；不连接数据库。 */
function setup(events = [], completed = []) {
  const source = [...events].sort(compareKeys)
  const calls = []
  const clickhouse = {
    async query(sql, params, settings, signal) {
      calls.push({ sql, params, settings, signal })
      if (/FROM event_log\b/.test(sql)) {
        const after = 'afterTime' in params ? {
          service_time: params.afterTime, session_id: params.afterSession, event_name: params.afterEvent,
        } : null
        return source.filter(row => row.date <= params.throughDate &&
          (!params.targetDate || row.date === params.targetDate) &&
          (!after || compareKeys(row, after) > 0)).slice(0, params.pageSize)
      }
      assert.match(sql, /FROM final_event_log\b/)
      const candidates = new Set(params.candidateSlices.map(tuple => JSON.stringify(tuple.values)))
      return [...new Map(completed.filter(row => candidates.has(keyOf(row))).map(row => [keyOf(row), row])).values()]
    },
  }
  return { clickhouse, calls }
}

test('首页只按物理排序键读取有限事件键，不做源表全量 DISTINCT/NOT IN/OFFSET', async () => {
  const state = setup([sourceRow('2026-10-14', '00:00:00.001', 'session-1')])
  const page = await readCleaningBacklogPage(state.clickhouse, RANGE, null, 1000)
  const source = state.calls[0]
  assert.doesNotMatch(source.sql, /\bDISTINCT\b|\bNOT IN\b|\bOFFSET\b|SELECT\s+\*/i)
  assert.match(source.sql, /ORDER BY `\$service_time`, `\$session_id`, `\$event_name`/)
  assert.match(source.sql, /LIMIT \{pageSize:UInt32\}/)
  assert.match(source.sql, /toString\(`\$service_time`\) AS service_time/)
  assert.deepEqual(source.params, { throughDate: '2026-10-14', pageSize: 1000 })
  assert.deepEqual(page.rows, [{ date: '2026-10-14', session_id: 'session-1' }])
  assert.deepEqual(page.nextCursor, { serviceTime: '2026-10-14 00:00:00.001', sessionId: 'session-1', eventName: 'click' })
  assert.equal(page.done, true)
})

test('毫秒游标原样回传，续页使用全部三个键并参数化空/特殊字符 session', async () => {
  const sessionId = "s'\\\n{afterSession:String}"
  const cursor = { serviceTime: '2026-10-14 01:02:03.009', sessionId, eventName: '' }
  const state = setup([sourceRow('2026-10-14', '01:02:03.010', '', 'click')])
  const page = await readCleaningBacklogPage(state.clickhouse, RANGE, cursor, 1)
  const source = state.calls[0]
  assert.match(source.sql, /\(`\$service_time`, `\$session_id`, `\$event_name`\) >/)
  assert.match(source.sql, /toDateTime64\(\{afterTime:String\}, 3\), \{afterSession:String\}, \{afterEvent:String\}/)
  assert.equal(source.params.afterTime, cursor.serviceTime)
  assert.equal(source.params.afterSession, sessionId)
  assert.equal(source.params.afterEvent, '')
  assert.ok(!source.sql.includes(sessionId))
  assert.equal(page.nextCursor.serviceTime, '2026-10-14 01:02:03.010')
  assert.equal(page.nextCursor.sessionId, '')
  assert.deepEqual(cursor, { serviceTime: '2026-10-14 01:02:03.009', sessionId, eventName: '' })
})

test('分页边界含相同排序键时可跳过剩余同键行，仍能发现全部未洗切片', async () => {
  const sameKey = sourceRow('2026-10-12', '01:00:00.001', 'alpha')
  const events = [
    ...Array.from({ length: 8 }, () => ({ ...sameKey })),
    sourceRow('2026-10-12', '01:00:00.001', 'alpha', 'page_view'),
    sourceRow('2026-10-12', '01:00:00.001', 'beta'),
    sourceRow('2026-10-12', '01:00:00.002', 'gamma'),
    sourceRow('2026-10-13', '00:00:00.000', 'alpha'),
    sourceRow('2026-10-14', '00:00:00.000', 'delta'),
  ]
  const state = setup(events)
  let cursor = null
  const discovered = new Set()
  let pages = 0
  while (true) {
    const page = await readCleaningBacklogPage(state.clickhouse, RANGE, cursor, 3)
    page.rows.forEach(row => discovered.add(keyOf(row)))
    pages++
    assert.ok(pages < 10, '游标必须前进，不能反复读取同键行')
    if (page.done) break
    assert.ok(page.nextCursor)
    cursor = page.nextCursor
  }
  assert.deepEqual([...discovered].sort(), [...new Set(events.map(keyOf))].sort())
  assert.ok(pages < Math.ceil(events.length / 3), '同键行只用于发现同一个切片，无需再次读取')
})

test('同 session 跨日期按切片查重，仅跳过最终表已存在的那一天', async () => {
  const events = [
    sourceRow('2026-10-13', '23:59:59.999', 'shared'),
    sourceRow('2026-10-14', '00:00:00.000', 'shared'),
    sourceRow('2026-10-14', '00:00:00.001', 'shared'),
    sourceRow('2026-10-14', '00:00:00.002', 'new'),
  ]
  const state = setup(events, [{ date: '2026-10-13', session_id: 'shared' }])
  const page = await readCleaningBacklogPage(state.clickhouse, RANGE, null, 10)
  assert.deepEqual(page.rows, [
    { date: '2026-10-14', session_id: 'shared' },
    { date: '2026-10-14', session_id: 'new' },
  ])
  const query = state.calls[1]
  assert.deepEqual(query.params.candidateSlices.map(tuple => tuple.values), [
    ['2026-10-13', 'shared'], ['2026-10-14', 'shared'], ['2026-10-14', 'new'],
  ])
  assert.equal(query.params.firstDate, '2026-10-13')
  assert.equal(query.params.lastDate, '2026-10-14')
  assert.match(query.sql, /IN \{candidateSlices:Array\(Tuple\(Date,String\)\)\}/)
  assert.equal(query.settings.max_result_rows, 3)
  assert.equal(query.settings.max_rows_in_set, 3)
})

test('全页候选已洗时仍推进源游标并继续，不能用任务数判断扫描结束', async () => {
  const events = [
    sourceRow('2026-10-14', '00:00:00.001', 'done-1'),
    sourceRow('2026-10-14', '00:00:00.002', 'done-2'),
    sourceRow('2026-10-14', '00:00:00.003', 'pending'),
  ]
  const state = setup(events, events.slice(0, 2).map(row => ({ date: row.date, session_id: row.session_id })))
  const first = await readCleaningBacklogPage(state.clickhouse, RANGE, null, 2)
  assert.deepEqual(first.rows, [])
  assert.equal(first.done, false)
  assert.equal(first.nextCursor.sessionId, 'done-2')
  const second = await readCleaningBacklogPage(state.clickhouse, RANGE, first.nextCursor, 2)
  assert.deepEqual(second.rows, [{ date: '2026-10-14', session_id: 'pending' }])
  assert.equal(second.done, true)
})

test('空源页立即结束且不查询最终表', async () => {
  const state = setup()
  assert.deepEqual(await readCleaningBacklogPage(state.clickhouse, RANGE, null, 100), {
    rows: [], nextCursor: null, done: true,
  })
  assert.equal(state.calls.length, 1)
})

test('整页恰好达到 limit 时仅下一空页才结束', async () => {
  const state = setup([sourceRow('2026-10-14', '00:00:00.000', 'only')])
  const first = await readCleaningBacklogPage(state.clickhouse, RANGE, null, 1)
  assert.equal(first.done, false)
  const second = await readCleaningBacklogPage(state.clickhouse, RANGE, first.nextCursor, 1)
  assert.equal(second.done, true)
  assert.equal(second.nextCursor, null)
})

test('不指定日期覆盖历史截至 throughDate，指定日期同时限制上下界并排除其他日期', async () => {
  const events = [
    sourceRow('2026-10-12', '23:59:59.999', 'past'),
    sourceRow('2026-10-13', '00:00:00.000', 'target'),
    sourceRow('2026-10-14', '23:59:59.999', 'yesterday'),
    sourceRow('2026-10-15', '00:00:00.000', 'today'),
  ]
  const all = setup(events)
  assert.deepEqual((await readCleaningBacklogPage(all.clickhouse, RANGE, null, 10)).rows.map(row => row.session_id), ['past', 'target', 'yesterday'])
  const target = setup(events)
  assert.deepEqual((await readCleaningBacklogPage(target.clickhouse, { ...RANGE, targetDate: '2026-10-13' }, null, 10)).rows.map(row => row.session_id), ['target'])
  const query = target.calls[0]
  assert.equal(query.params.targetDate, '2026-10-13')
  assert.match(query.sql, />= toDateTime64\(\{targetDate:String\}, 3\)/)
  assert.match(query.sql, /< toDateTime64\(\{targetDate:String\}, 3\) \+ INTERVAL 1 DAY/)
  assert.match(query.sql, /< toDateTime64\(\{throughDate:String\}, 3\) \+ INTERVAL 1 DAY/)
})

test('候选 tuple 使用客户端真实序列化，特殊字符通过参数安全传递', async () => {
  const sessionId = "s'\\\n"
  const state = setup([sourceRow('2026-10-14', '00:00:00.001', sessionId)])
  await readCleaningBacklogPage(state.clickhouse, RANGE, null, 10)
  const query = state.calls[1]
  assert.ok(!query.sql.includes(sessionId))
  assert.equal(formatQueryParams({ value: query.params.candidateSlices }), "[('2026-10-14','s\\'\\\\\\n')]")
})

test('两个有限查询均设置内存/线程/超时上限并透传 AbortSignal', async () => {
  const state = setup([sourceRow('2026-10-14', '00:00:00.000', 'one')])
  const controller = new AbortController()
  await readCleaningBacklogPage(state.clickhouse, RANGE, null, 1000, controller.signal)
  assert.equal(state.calls.length, 2)
  for (const call of state.calls) {
    assert.equal(call.signal, controller.signal)
    assert.equal(call.settings.max_threads, 2)
    assert.equal(call.settings.max_memory_usage, 256 * 1024 * 1024)
    assert.equal(call.settings.max_execution_time, 30)
    assert.equal(call.settings.result_overflow_mode, 'throw')
    assert.ok(call.settings.max_result_rows <= 1000)
  }
  assert.equal(state.calls[0].settings.optimize_read_in_order, 1)
})

for (const failureAt of ['source', 'final']) {
  test(`${failureAt} 查询失败原样上抛，不返回已推进的伪成功页`, async () => {
    const expected = new Error(`${failureAt} unavailable`)
    const state = setup([sourceRow('2026-10-14', '00:00:00.001', 'one')])
    const original = state.clickhouse.query
    state.clickhouse.query = async (...args) => {
      if (args[0].includes(failureAt === 'source' ? 'FROM event_log' : 'FROM final_event_log')) throw expected
      return original(...args)
    }
    await assert.rejects(readCleaningBacklogPage(state.clickhouse, RANGE, null, 1), error => error === expected)
  })
}

test('非法页大小在执行任何 IO 前拒绝', async () => {
  const state = setup()
  for (const size of [0, -1, 1.5, NaN, Infinity]) {
    await assert.rejects(readCleaningBacklogPage(state.clickhouse, RANGE, null, size), RangeError)
  }
  assert.equal(state.calls.length, 0)
})
