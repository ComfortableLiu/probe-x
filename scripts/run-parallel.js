#!/usr/bin/env node
/**
 * 在多个 workspace 中并行执行同一个 yarn script。
 *
 * 用法: node scripts/run-parallel.js <script> <workspace> [<workspace>...]
 *
 * yarn 1 的 workspaces 只会串行执行（`yarn workspaces run`），拉不起多个长驻进程，
 * 也没法并发构建，所以这里做最小补充：并行派发、逐行加前缀、任一失败即整体失败。
 */
const { spawn } = require('node:child_process')

const [, , script, ...workspaces] = process.argv

if (!script || workspaces.length === 0) {
  console.error('用法: node scripts/run-parallel.js <script> <workspace> [<workspace>...]')
  process.exit(1)
}

const isWindows = process.platform === 'win32'
const useColor = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR
const colors = ['36', '32', '33', '35', '34', '31']
const width = Math.max(...workspaces.map((workspace) => workspace.length))

const children = []
let failed = false

// rspack / rollup 是 yarn 拉起的孙进程，只 kill 直接子进程会把开发服务器留在后台，
// 所以 POSIX 下用独立进程组启动，收尾时整组终止
function stopAll() {
  for (const { child } of children) {
    if (child.exitCode !== null || child.signalCode !== null) {
      continue
    }
    if (isWindows) {
      spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'])
      continue
    }
    try {
      process.kill(-child.pid, 'SIGTERM')
    } catch (error) {
      child.kill('SIGTERM')
    }
  }
}

function tagOf(workspace, index) {
  const tag = workspace.padEnd(width)
  return useColor ? `\u001b[${colors[index % colors.length]}m${tag}\u001b[0m` : tag
}

// 按行加前缀，避免多个服务的日志互相穿插后无法分辨来源
function pipeWithPrefix(stream, label) {
  let pending = ''
  stream.setEncoding('utf8')
  stream.on('data', (chunk) => {
    pending += chunk
    const lines = pending.split('\n')
    pending = lines.pop()
    for (const line of lines) {
      console.log(`${label} ${line}`)
    }
  })
  stream.on('end', () => {
    if (pending) {
      console.log(`${label} ${pending}`)
    }
  })
}

workspaces.forEach((workspace, index) => {
  const label = tagOf(workspace, index)
  const child = spawn('yarn', ['workspace', workspace, script], {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: isWindows,
    detached: !isWindows,
  })
  children.push({ workspace, child })

  pipeWithPrefix(child.stdout, label)
  pipeWithPrefix(child.stderr, label)

  child.on('error', (error) => {
    failed = true
    console.error(`${label} 启动失败: ${error.message}`)
    stopAll()
    process.exitCode = 1
  })

  child.on('exit', (code, signal) => {
    if (failed || signal) {
      // signal：被 stopAll 统一终止，不重复报错
      return
    }
    if (code !== 0) {
      failed = true
      console.error(`${label} 退出码 ${code}，正在停止其余任务`)
      stopAll()
      process.exitCode = code || 1
    }
  })
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    stopAll()
    process.exit(1)
  })
}

process.on('exit', stopAll)
