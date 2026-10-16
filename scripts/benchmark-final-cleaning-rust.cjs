#!/usr/bin/env node
// Entirely local transport benchmark. The child receives only the temporary env
// below, never the repository's configured databases or the caller's environment.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const http = require('node:http')
const net = require('node:net')
const os = require('node:os')
const path = require('node:path')
const zlib = require('node:zlib')
const { spawn } = require('node:child_process')
const { performance } = require('node:perf_hooks')
const grpc = require('@grpc/grpc-js')
const protoLoader = require('@grpc/proto-loader')

function optionsFromArgs(args) {
  const options = {
    binary: '', sessions: 224, eventsPerSession: 7, capacity: 14, cpuThreads: undefined,
    redisLatencyMs: 20, httpLatencyMs: 10, timeoutMs: 60000,
    label: 'local-rust-cleaning', output: '',
  }
  const names = {
    '--binary': 'binary', '--sessions': 'sessions', '--capacity': 'capacity', '--cpu-threads': 'cpuThreads',
    '--redis-latency-ms': 'redisLatencyMs', '--http-latency-ms': 'httpLatencyMs',
    '--timeout-ms': 'timeoutMs', '--label': 'label', '--output': 'output',
  }
  for (let index = 0; index < args.length; index++) {
    const key = names[args[index]]
    if (!key || args[index + 1] === undefined) throw new Error(`Unknown or incomplete option: ${args[index]}`)
    const value = args[++index]
    options[key] = typeof options[key] === 'number' || key === 'cpuThreads' ? Number(value) : value
  }
  if (!options.binary) throw new Error('Pass --binary /absolute/path/to/probe-x-final-cleaning-rust')
  options.binary = path.resolve(options.binary)
  assert(fs.statSync(options.binary).isFile(), 'The specified binary must exist')
  options.cpuThreads ??= options.capacity
  for (const key of ['sessions', 'capacity', 'cpuThreads', 'timeoutMs']) {
    assert(Number.isSafeInteger(options[key]) && options[key] > 0, `Invalid ${key}`)
  }
  for (const key of ['redisLatencyMs', 'httpLatencyMs']) {
    assert(Number.isFinite(options[key]) && options[key] >= 0, `Invalid ${key}`)
  }
  return options
}

function deferred() {
  let resolve
  let reject
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      server.removeListener('error', reject)
      resolve(server.address().port)
    })
  })
}

function respBulk(value) {
  if (value === undefined || value === null) return '$-1\r\n'
  const text = String(value)
  return `$${Buffer.byteLength(text)}\r\n${text}\r\n`
}

// Return undefined without consuming anything when TCP supplied a partial frame.
function parseResp(buffer, offset = 0) {
  const lineEnd = buffer.indexOf('\r\n', offset)
  if (lineEnd < 0) return undefined
  const prefix = String.fromCharCode(buffer[offset])
  const value = buffer.toString('utf8', offset + 1, lineEnd)
  let next = lineEnd + 2
  if (prefix === '*') {
    const count = Number(value)
    assert(Number.isInteger(count) && count >= 0, 'Invalid RESP array')
    const values = []
    for (let index = 0; index < count; index++) {
      const item = parseResp(buffer, next)
      if (!item) return undefined
      values.push(item.value)
      next = item.next
    }
    return { value: values, next }
  }
  if (prefix === '$') {
    const length = Number(value)
    if (length === -1) return { value: null, next }
    assert(Number.isInteger(length) && length >= 0, 'Invalid RESP bulk length')
    if (buffer.length < next + length + 2) return undefined
    assert.equal(buffer.toString('ascii', next + length, next + length + 2), '\r\n')
    return { value: buffer.toString('utf8', next, next + length), next: next + length + 2 }
  }
  if (prefix === '+' || prefix === '-' || prefix === ':') return { value, next }
  throw new Error(`Unexpected RESP type ${prefix}`)
}

function createRedisMock(latencyMs, failures) {
  const values = new Map()
  const sets = new Map()
  const hashes = new Map()
  const sockets = new Set()
  const stats = { commands: 0, byCommand: {}, latencyMs: [], connections: 0, maximumPipelined: 0 }
  function classify(args) {
    const command = args[0].toUpperCase()
    if (command === 'SET') return args.some(value => value.toUpperCase() === 'NX') ? 'SET_lease' : 'SET_done'
    if (command === 'EVAL') {
      if (args[1].includes("'GET'")) return args[1].includes("'DEL'") ? 'EVAL_release' : 'EVAL_renew'
      return 'EVAL_metrics'
    }
    return command
  }
  function reply(args) {
    const command = args[0].toUpperCase()
    const key = args[1]
    switch (command) {
      case 'PING': return '+PONG\r\n'
      case 'CLIENT':
      case 'AUTH':
      case 'SELECT': return '+OK\r\n'
      case 'ECHO': return respBulk(key)
      case 'SET': {
        if (args.some(value => value.toUpperCase() === 'NX') && values.has(key)) return respBulk(null)
        values.set(key, args[2])
        return '+OK\r\n'
      }
      case 'GET': return respBulk(values.get(key))
      case 'EXISTS': return `:${args.slice(1).filter(item => values.has(item) || sets.has(item) || hashes.has(item)).length}\r\n`
      case 'DEL': {
        let count = 0
        for (const item of args.slice(1)) {
          count += Number(values.delete(item))
          count += Number(sets.delete(item))
          count += Number(hashes.delete(item))
        }
        return `:${count}\r\n`
      }
      case 'SADD': {
        if (!sets.has(key)) sets.set(key, new Set())
        let count = 0
        for (const item of args.slice(2)) {
          if (!sets.get(key).has(item)) { sets.get(key).add(item); count++ }
        }
        return `:${count}\r\n`
      }
      case 'SREM': {
        let count = 0
        for (const item of args.slice(2)) count += Number(sets.get(key)?.delete(item))
        return `:${count}\r\n`
      }
      case 'EVAL': {
        assert.equal(Number(args[2]), 1, 'Every Lua script must operate on one key')
        if (args[1].includes("'GET'")) {
          const owns = values.get(args[3]) === args[4]
          if (owns && args[1].includes("'DEL'")) values.delete(args[3])
          return `:${Number(owns)}\r\n`
        }
        // Telemetry scripts do not influence the task's durable completion state.
        return ':1\r\n'
      }
      case 'EXPIRE': return ':1\r\n'
      default: throw new Error(`Unsupported local Redis command: ${command}`)
    }
  }
  const server = net.createServer(socket => {
    sockets.add(socket)
    stats.connections++
    socket.setNoDelay(true)
    let buffer = Buffer.alloc(0)
    const pending = []
    let timer
    function flushResponses() {
      timer = undefined
      if (socket.destroyed) return
      const now = performance.now()
      const replies = []
      while (pending.length && pending[0].readyAt <= now) {
        const response = pending.shift()
        stats.latencyMs.push(now - response.receivedAt)
        replies.push(response.reply)
      }
      if (replies.length) socket.write(replies.join(''))
      scheduleResponses()
    }
    function scheduleResponses() {
      if (timer || !pending.length || socket.destroyed) return
      timer = setTimeout(flushResponses, Math.max(0, Math.ceil(pending[0].readyAt - performance.now())))
    }
    socket.on('data', chunk => {
      try {
        buffer = Buffer.concat([buffer, chunk])
        let offset = 0
        while (offset < buffer.length) {
          const frame = parseResp(buffer, offset)
          if (!frame) break
          offset = frame.next
          assert(Array.isArray(frame.value), 'Expected RESP command array')
          const receivedAt = performance.now()
          const command = classify(frame.value)
          stats.commands++
          stats.byCommand[command] = (stats.byCommand[command] || 0) + 1
          // Execute commands in arrival order. Responses have independently fixed
          // RTTs, so pipeline requests overlap rather than adding 20 ms per command.
          pending.push({ receivedAt, readyAt: receivedAt + latencyMs, reply: reply(frame.value) })
          stats.maximumPipelined = Math.max(stats.maximumPipelined, pending.length)
        }
        buffer = buffer.subarray(offset)
        scheduleResponses()
      } catch (error) {
        failures.push(error)
        socket.destroy(error)
      }
    })
    socket.on('error', error => { if (!socket.destroyed) failures.push(error) })
    socket.on('close', () => { clearTimeout(timer); sockets.delete(socket) })
  })
  return { server, values, sets, stats, close: () => { for (const socket of sockets) socket.destroy(); server.close() } }
}

function generateSource(sessionCount) {
  const date = '2026-10-14'
  const sessions = new Map()
  const expectedAttrs = new Map()
  const camelCase = key => key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
  for (let sessionIndex = 0; sessionIndex < sessionCount; sessionIndex++) {
    const session = `benchmark-session-${String(sessionIndex).padStart(4, '0')}`
    const pages = [0, 1, 2].map(index => `${session}-page-${index}`)
    const names = ['page_view', 'click', 'page_view', 'click', 'page_view', 'add_to_cart', 'purchase']
    const rows = names.map((name, index) => {
      const pageIndex = index < 2 ? 0 : index < 4 ? 1 : 2
      const attribution = index === 2 || index === 4
      const time = `${date} 02:${String(sessionIndex % 60).padStart(2, '0')}:${String(index).padStart(2, '0')}.000`
      const params = attribution ? { $campaign_id: `campaign-${sessionIndex % 5}`, product_id: `product-${sessionIndex}-${pageIndex}`, position: pageIndex } : {}
      return {
        $event_id: `${session}-event-${index}`, $event_name: name,
        $session_id: session, $device_id: `${session}-device`, $uid: sessionIndex + 1000,
        $log_time: time, $service_time: time,
        $page_id: pages[pageIndex], $source_page_id: pageIndex ? pages[pageIndex - 1] : '',
        $target_page_id: attribution ? pages[pageIndex] : '', $is_attribution_event: attribution,
        $ex_attribution_params: attribution ? JSON.stringify(params) : '',
        $web_site: 'benchmark.example.test', $web_pathname: ['/home', '/products', '/product/detail'][pageIndex],
        $web_params: '', $ip: '127.0.0.1', $ua: 'Probe-X local benchmark', $language: 'zh-CN',
        $device: 'desktop', $screen_width: 1920, $screen_height: 1080,
        $viewport_width: 1440, $viewport_height: 900, $scroll_height: 2000, $device_pixel_ratio: 2,
        $utm_source: 'synthetic', $utm_medium: 'benchmark', $utm_campaign: 'rust-cleaning',
        $utm_content: '', $utm_term: '', $referrer: '', $zoon: 8, $element_id: name === 'click' ? `button-${index}` : '',
        $spm: attribution ? 'benchmark.products.card.open' : '', $scm: '',
        $spm_a: attribution ? 'Benchmark' : '', $spm_b: attribution ? 'Products' : '',
        $spm_c: attribution ? 'Card' : '', $spm_d: attribution ? 'Open' : '',
        $spm_a_description: '', $spm_b_description: '', $spm_c_description: '', $spm_d_description: '',
        $scm_a: '', $scm_b: '', $scm_c: '', $scm_d: '',
        $scm_a_description: '', $scm_b_description: '', $scm_c_description: '', $scm_d_description: '',
      }
    })
    sessions.set(session, rows)
    expectedAttrs.set(session, rows.flatMap(row => row.$is_attribution_event
      ? Object.entries(JSON.parse(row.$ex_attribution_params)).map(([key, value]) => ({
        event_id: row.$event_id, session_id: session, attr_key: camelCase(key), attr_value: String(value), event_time: row.$service_time,
      })) : []))
  }
  return { date, sessions, expectedAttrs }
}

function parseHttpFields(request, rawBody) {
  const encodedBytes = rawBody.length
  if (request.headers['content-encoding'] === 'gzip') rawBody = zlib.gunzipSync(rawBody)
  const text = rawBody.toString('utf8')
  const url = new URL(request.url, 'http://127.0.0.1')
  const fields = Object.fromEntries(url.searchParams)
  const boundary = request.headers['content-type']?.match(/boundary=(?:"([^"]+)"|([^;]+))/)?.slice(1).find(Boolean)
  if (boundary) {
    for (const part of text.split(`--${boundary}`)) {
      const delimiter = part.indexOf('\r\n\r\n')
      if (delimiter < 0) continue
      const name = part.slice(0, delimiter).match(/\bname="([^"]+)"/)?.[1]
      if (name) fields[name] = part.slice(delimiter + 4).replace(/\r\n$/, '')
    }
  } else if (fields.query && /^INSERT/i.test(fields.query) && text !== fields.query) {
    fields.query += `\n${text}`
  } else fields.query = text || fields.query
  return { fields, encodedBytes, decodedBytes: rawBody.length }
}

function createClickHouseMock(source, latencyMs, failures) {
  const finalEvents = []
  const attributions = []
  const stats = { requests: 0, byStage: {}, gzipRequests: 0, gzipResponses: 0, encodedRequestBytes: 0, decodedRequestBytes: 0, maximumInFlight: 0 }
  const sockets = new Set()
  let inFlight = 0
  let lastInsertAt
  let lastInsertResponseAt
  function jsonLines(rows) { return rows.map(row => JSON.stringify(row)).join('\n') + (rows.length ? '\n' : '') }
  function execute(fields) {
    const sql = fields.query || ''
    const session = fields.param_sessionId
    if (/^\s*INSERT\s+INTO\s+(final_event_log|event_attribution)\b/i.test(sql)) {
      const table = sql.match(/^\s*INSERT\s+INTO\s+(\w+)/i)[1]
      const rows = sql.slice(sql.indexOf('\n') + 1).split('\n').filter(Boolean).map(row => JSON.parse(row))
      assert(rows.length, 'INSERT must contain at least one row')
      const destination = table === 'final_event_log' ? finalEvents : attributions
      for (const row of rows) destination.push(row)
      lastInsertAt = performance.now()
      return { stage: `insert_${table}`, response: '', rows: rows.length, sessions: new Set(rows.map(row => row.$session_id || row.session_id)).size }
    }
    if (sql.includes('count() AS count FROM event_log')) {
      assert(source.sessions.has(session), `Unknown source session ${session}`)
      return { stage: 'count', response: jsonLines([{ count: String(source.sessions.get(session).length) }]), rows: 1 }
    }
    if (/SELECT\s+\*\s+FROM\s+event_log/i.test(sql)) {
      assert(source.sessions.has(session), `Unknown source session ${session}`)
      return { stage: 'read', response: jsonLines(source.sessions.get(session)), rows: source.sessions.get(session).length }
    }
    if (sql.includes('FROM final_event_log')) {
      const ids = new Set(JSON.parse(fields.param_eventIds))
      const rows = finalEvents.filter(row => row.$session_id === session && ids.has(row.$event_id)).map(row => ({ $event_id: row.$event_id }))
      return { stage: 'event_lookup', response: jsonLines(rows), rows: rows.length }
    }
    if (sql.includes('FROM event_attribution')) {
      const keys = new Set(JSON.parse(fields.param_attributionKeys).map(row => JSON.stringify(row)))
      const grouped = new Map()
      for (const row of attributions) {
        const key = JSON.stringify([row.event_id, row.attr_key, row.attr_value])
        if (row.session_id !== session || !keys.has(key)) continue
        if (!grouped.has(key)) grouped.set(key, { event_id: row.event_id, attr_key: row.attr_key, attr_value: row.attr_value, rows: 0 })
        grouped.get(key).rows++
      }
      const rows = [...grouped.values()]
      return { stage: 'attribution_lookup', response: jsonLines(rows), rows: rows.length }
    }
    if (/^\s*SELECT\b/i.test(sql) && !/\bFROM\b/i.test(sql)) return { stage: 'health', response: jsonLines([{ ok: 1 }]), rows: 1 }
    throw new Error(`Unsupported local ClickHouse SQL: ${sql.slice(0, 160)}`)
  }
  const server = http.createServer((request, response) => {
    const receivedAt = performance.now()
    const chunks = []
    inFlight++
    stats.maximumInFlight = Math.max(stats.maximumInFlight, inFlight)
    request.on('data', chunk => chunks.push(chunk))
    request.on('error', error => failures.push(error))
    request.on('end', () => {
      let parsed
      try { parsed = parseHttpFields(request, Buffer.concat(chunks)) } catch (error) {
        failures.push(error)
        inFlight--
        response.writeHead(500); response.end('Invalid benchmark HTTP request')
        return
      }
      stats.requests++
      stats.encodedRequestBytes += parsed.encodedBytes
      stats.decodedRequestBytes += parsed.decodedBytes
      if (request.headers['content-encoding'] === 'gzip') stats.gzipRequests++
      setTimeout(() => {
        try {
          const result = execute(parsed.fields)
          const stage = stats.byStage[result.stage] ||= { requests: 0, rows: 0, latencyMs: [], maxSessionsPerInsert: 0 }
          stage.requests++
          stage.rows += result.rows
          stage.maxSessionsPerInsert = Math.max(stage.maxSessionsPerInsert, result.sessions || 0)
          let body = Buffer.from(result.response)
          const headers = { 'content-type': 'application/x-ndjson' }
          if (body.length && /\bgzip\b/.test(request.headers['accept-encoding'] || '')) {
            body = zlib.gzipSync(body)
            headers['content-encoding'] = 'gzip'
            stats.gzipResponses++
          }
          response.writeHead(200, headers)
          response.end(body, () => {
            stage.latencyMs.push(performance.now() - receivedAt)
            if (result.stage.startsWith('insert_')) lastInsertResponseAt = performance.now()
            inFlight--
          })
        } catch (error) {
          failures.push(error)
          inFlight--
          response.writeHead(500); response.end('Unsupported benchmark operation')
        }
      }, latencyMs)
    })
  })
  server.on('connection', socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)) })
  return {
    server, finalEvents, attributions, stats,
    get lastInsertAt() { return lastInsertAt },
    get lastInsertResponseAt() { return lastInsertResponseAt },
    close: () => { for (const socket of sockets) socket.destroy(); server.close() },
  }
}

function sortedRows(rows, key) { return [...rows].sort((left, right) => key(left).localeCompare(key(right))) }
const eventKey = row => row.$event_id
const attrKey = row => JSON.stringify([row.event_id, row.attr_key, row.attr_value, row.event_time])

function validateSession(session, source, clickhouse) {
  const events = clickhouse.finalEvents.filter(row => row.$session_id === session)
  const attrs = clickhouse.attributions.filter(row => row.session_id === session)
  assert.deepEqual(sortedRows(events, eventKey), sortedRows(source.sessions.get(session), eventKey), `Final events incomplete or duplicated for ${session}`)
  assert.deepEqual(sortedRows(attrs, attrKey), sortedRows(source.expectedAttrs.get(session), attrKey), `Attribution KV incomplete or duplicated for ${session}`)
}

function summary(values) {
  if (!values.length) return { count: 0, mean: 0, min: 0, max: 0 }
  const round = value => Math.round(value * 100) / 100
  return { count: values.length, mean: round(values.reduce((sum, value) => sum + value, 0) / values.length), min: round(Math.min(...values)), max: round(Math.max(...values)) }
}

async function main() {
  const options = optionsFromArgs(process.argv.slice(2))
  const source = generateSource(options.sessions)
  const failures = []
  const redis = createRedisMock(options.redisLatencyMs, failures)
  const clickhouse = createClickHouseMock(source, options.httpLatencyMs, failures)
  const master = new grpc.Server()
  const completed = new Set()
  const active = new Set()
  const sessionList = [...source.sessions.keys()]
  const tasks = sessionList.map((session, index) => ({ task_id: `benchmark-task-${index}`, session_id: session, date: source.date }))
  const taskById = new Map(tasks.map(task => [task.task_id, task]))
  const allCompleted = deferred()
  let child
  let tempDirectory
  let shuttingDown = false
  let taskIndex = 0
  let firstTaskAt
  let completedAt
  let registeredCapacity
  let maximumActive = 0
  let childOutput = ''
  let stream
  let timer
  let progressFrames = 0
  let protocolFailure
  const definition = protoLoader.loadSync(path.resolve(__dirname, '../libs/shared-utils/src/lib/backend-common/proto/final_data_cleaning_control_bi_stream.proto'), {
    keepCase: true, longs: String, enums: String, defaults: true, oneofs: true,
  })
  const service = grpc.loadPackageDefinition(definition).final_data_cleaning_control_bi_stream.NodeControlService.service
  function dispatch(call) {
    while (active.size < options.capacity && taskIndex < tasks.length) {
      const task = tasks[taskIndex++]
      if (firstTaskAt === undefined) firstTaskAt = performance.now()
      active.add(task.task_id)
      maximumActive = Math.max(maximumActive, active.size)
      call.write({ task })
    }
  }
  master.addService(service, {
    connect: call => {
      stream = call
      let registered = false
      call.on('data', frame => {
        try {
          if (frame.register && !registered) {
            registered = true
            registeredCapacity = frame.register.info.task_capacity
            assert.equal(registeredCapacity, options.capacity, 'Node advertised an unexpected task capacity')
            call.write({ ack: { accepted: true, message: 'Local benchmark master' } })
            dispatch(call)
          }
          if (frame.progress) {
            progressFrames++
            const progress = frame.progress
            if (progress.failed) throw new Error(`Rust task ${progress.task_id} failed: ${progress.error}`)
            if (!progress.completed || completed.has(progress.task_id)) return
            assert(active.has(progress.task_id), `Unexpected completed task ${progress.task_id}`)
            const task = taskById.get(progress.task_id)
            validateSession(task.session_id, source, clickhouse)
            assert.equal(progress.progress, source.sessions.get(task.session_id).length, 'Completed progress must cover every source event')
            assert(redis.values.has(`probe-x:rust-clean:done:${progress.task_id}`), 'Task completed without its Redis done marker')
            active.delete(progress.task_id)
            completed.add(progress.task_id)
            if (completed.size === tasks.length) {
              completedAt = performance.now()
              allCompleted.resolve()
            } else dispatch(call)
          }
        } catch (error) { protocolFailure = error; allCompleted.reject(error) }
      })
      call.on('error', error => { if (!shuttingDown) allCompleted.reject(error) })
      call.on('end', () => { if (!shuttingDown && completed.size !== tasks.length) allCompleted.reject(new Error('Rust gRPC stream ended early')) })
    },
  })
  try {
    const [redisPort, clickhousePort] = await Promise.all([listen(redis.server), listen(clickhouse.server)])
    const masterPort = await new Promise((resolve, reject) => {
      master.bindAsync('127.0.0.1:0', grpc.ServerCredentials.createInsecure(), (error, port) => error ? reject(error) : resolve(port))
    })
    tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'probe-x-rust-local-benchmark-'))
    const localEnv = {
      RUST_NODE_ID: 'benchmark-rust-local', RUST_NODE_NAME: 'Local Rust benchmark',
      RUST_CLEANING_THREADS: options.cpuThreads, RUST_TASK_CONCURRENCY: options.capacity,
      RUST_HEALTH_HOST: '127.0.0.1', RUST_HEALTH_PORT: 0,
      MASTER_HOST: '127.0.0.1', MASTER_PORT: masterPort, NODE_ADVERTISE_ADDRESS: 'local-benchmark',
      HEARTBEAT_INTERVAL_MS: 1000, NODE_LOG_FLUSH_INTERVAL_MS: 1000, CLEANING_DETAIL_LOG_ENABLED: 'false',
      RUST_BATCH_SIZE: 1000, RUST_MAX_BATCH_BYTES: 8388608, RUST_MAX_EVENT_BYTES: 1048576,
      RUST_MAX_ATTRIBUTIONS_PER_BATCH: 100000, RUST_SLICE_LEASE_SECONDS: 120, RUST_SHUTDOWN_TIMEOUT_SECONDS: 5,
      CLICKHOUSE_HOST: `http://127.0.0.1:${clickhousePort}`, CLICKHOUSE_USER: 'default', CLICKHOUSE_PASSWORD: '',
      CLICKHOUSE_DATABASE: 'benchmark_local', CLICKHOUSE_REQUEST_TIMEOUT: 30000, CLICKHOUSE_CONNECTION_TIMEOUT: 10000,
      CLICKHOUSE_REJECT_UNAUTHORIZED: 'true', CLICKHOUSE_COMPRESSION: 'true',
      REDIS_HOST: '127.0.0.1', REDIS_PORT: redisPort, REDIS_USERNAME: '', REDIS_PASSWORD: '', REDIS_DB: 0,
      REDIS_CONNECT_TIMEOUT: 10000, REDIS_COMMAND_TIMEOUT: 5000, REDIS_TLS_ENABLED: 'false',
      REDIS_CLUSTER_ENABLED: 'false', REDIS_CLUSTER_NODES: '',
    }
    const envFile = path.join(tempDirectory, 'local-only.env')
    fs.writeFileSync(envFile, Object.entries(localEnv).map(([key, value]) => `${key}=${JSON.stringify(String(value))}`).join('\n') + '\n', { mode: 0o600 })
    const startupAt = performance.now()
    // Deliberately do not spread process.env: no credential or remote endpoint can
    // override the isolated env file, and no HTTP proxy can route local requests.
    child = spawn(options.binary, ['--env-file', envFile], {
      cwd: tempDirectory, env: { PATH: '/usr/bin:/bin:/usr/sbin:/sbin' }, stdio: ['ignore', 'pipe', 'pipe'],
    })
    const exited = deferred()
    child.stdout.on('data', chunk => { childOutput = (childOutput + chunk).slice(-16000) })
    child.stderr.on('data', chunk => { childOutput = (childOutput + chunk).slice(-16000) })
    child.on('error', error => allCompleted.reject(error))
    child.on('exit', (code, signal) => {
      exited.resolve({ code, signal })
      if (!shuttingDown && completed.size !== tasks.length) allCompleted.reject(new Error(`Rust exited early (${code ?? signal}): ${childOutput}`))
    })
    timer = setTimeout(() => allCompleted.reject(new Error(`Local benchmark timed out; completed ${completed.size}/${tasks.length}: ${childOutput}`)), options.timeoutMs)
    await allCompleted.promise
    clearTimeout(timer)
    assert(!protocolFailure, protocolFailure?.message)
    assert.equal(failures.length, 0, failures[0]?.stack)
    assert.equal(clickhouse.finalEvents.length, options.sessions * options.eventsPerSession)
    assert.equal(clickhouse.attributions.length, options.sessions * 6)
    assert.equal(new Set(clickhouse.finalEvents.map(eventKey)).size, clickhouse.finalEvents.length, 'Final events contain duplicates')
    assert.equal(new Set(clickhouse.attributions.map(attrKey)).size, clickhouse.attributions.length, 'Attribution KV contains duplicates')
    assert.equal(redis.sets.get(`probe-x:rust-clean:incomplete:${source.date}`)?.size || 0, 0, 'Completed slices still have repair markers')
    assert.equal([...redis.values.keys()].filter(key => key.startsWith('probe-x:rust-clean:lease:')).length, 0, 'Completed slices still hold leases')
    const round = value => Math.round(value * 100) / 100
    const report = {
      label: options.label, binary: options.binary, localOnly: true,
      input: { sessions: options.sessions, eventsPerSession: options.eventsPerSession, events: clickhouse.finalEvents.length, expectedAttributionRows: options.sessions * 6, cpuThreads: options.cpuThreads, capacity: options.capacity },
      simulatedLatencyMs: { redisPerCommand: options.redisLatencyMs, clickhousePerRequest: options.httpLatencyMs },
      timingMs: {
        startupUntilFirstTask: round(firstTaskAt - startupAt),
        completeDurableRows: round(clickhouse.lastInsertAt - firstTaskAt),
        lastInsertResponse: round(clickhouse.lastInsertResponseAt - firstTaskAt),
        allTerminalCompleted: round(completedAt - firstTaskAt),
        totalIncludingStartup: round(completedAt - startupAt),
      },
      scheduler: { completed: completed.size, maximumActive, registeredCapacity, progressFrames },
      redis: { ...redis.stats, latencyMs: summary(redis.stats.latencyMs) },
      clickhouse: {
        ...clickhouse.stats,
        byStage: Object.fromEntries(Object.entries(clickhouse.stats.byStage).map(([name, value]) => [name, {
          ...value, latencyMs: summary(value.latencyMs), meanRowsPerRequest: round(value.rows / value.requests),
        }])),
      },
      verification: { finalEvents: clickhouse.finalEvents.length, attributionRows: clickhouse.attributions.length, fullRowsAndKvMatch: true, duplicateEvents: 0, duplicateKv: 0, completedAfterBothTables: true },
    }
    // Shutdown may flush telemetry. Capture measured task counters before this
    // shutdown work, while still checking that the child actually exits cleanly.
    const snapshot = JSON.parse(JSON.stringify(report))
    shuttingDown = true
    child.kill('SIGTERM')
    const exitTimeout = setTimeout(() => child.kill('SIGKILL'), 8000)
    const exit = await exited.promise
    clearTimeout(exitTimeout)
    assert.equal(exit.code, 0, `Rust did not shut down cleanly: ${JSON.stringify(exit)} ${childOutput}`)
    snapshot.childExit = exit
    if (options.output) {
      const outputPath = path.resolve(options.output)
      fs.mkdirSync(path.dirname(outputPath), { recursive: true })
      fs.writeFileSync(outputPath, JSON.stringify(snapshot, null, 2) + '\n')
    }
    console.log(JSON.stringify(snapshot, null, 2))
  } finally {
    shuttingDown = true
    clearTimeout(timer)
    if (child && child.exitCode === null && !child.killed) child.kill('SIGKILL')
    if (stream) stream.end()
    master.forceShutdown()
    redis.close()
    clickhouse.close()
    if (tempDirectory) fs.rmSync(tempDirectory, { recursive: true, force: true })
  }
}

main().catch(error => { console.error(error.stack || error); process.exitCode = 1 })
