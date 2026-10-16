const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const { test } = require('node:test')

const root = path.resolve(__dirname, '..')
const script = path.join(root, 'scripts/start-final-cleaning-rust.sh')

function run(args) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'probe-x-rust-start-'))
  try {
    const cargo = path.join(directory, 'cargo')
    fs.writeFileSync(cargo, '#!/usr/bin/env node\nprocess.stdout.write(JSON.stringify({cwd:process.cwd(),args:process.argv.slice(2)}))\n', { mode: 0o755 })
    const result = spawnSync('bash', [script, ...args], { cwd: directory, encoding: 'utf8', env: { ...process.env, PATH: `${directory}:${path.dirname(process.execPath)}:${process.env.PATH}` } })
    assert.equal(result.status, 0, result.stderr)
    return JSON.parse(result.stdout)
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
}

test('默认从任意目录启动优化后的release版本，并原样转发配置参数', () => {
  const result = run(['--env-file', '/tmp/config with spaces.env', '--check'])
  assert.equal(result.cwd, root)
  assert.deepEqual(result.args, ['run', '--locked', '--manifest-path', path.join(root, 'apps/final-data-cleaning-rust/Cargo.toml'), '--release', '--', '--env-file', '/tmp/config with spaces.env', '--check'])
})

test('debug参数只影响构建模式，服务参数在双横线之后传递', () => {
  assert.deepEqual(run(['--debug', '--help']).args, ['run', '--locked', '--manifest-path', path.join(root, 'apps/final-data-cleaning-rust/Cargo.toml'), '--', '--help'])
})
