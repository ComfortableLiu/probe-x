const assert = require('node:assert/strict')
const { test } = require('node:test')
require('reflect-metadata')
require('ts-node').register({ transpileOnly: true, skipProject: true, compilerOptions: {
  target: 'ES2022', module: 'CommonJS', moduleResolution: 'node', experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true,
} })
const { buildTaskId, planCleaningTasks } = require('../apps/data-dashboard-api-service/src/api/compute-node/cleaning-scheduler.service.ts')

test('task_id 确定性生成，重试追加 :r{n} 后缀', () => {
  assert.equal(buildTaskId('2026-09-29', '2026-09-28', 's-1'), 'clean:2026-09-29:2026-09-28:s-1')
  assert.equal(buildTaskId('2026-09-29', '2026-09-28', 's-1', 2), 'clean:2026-09-29:2026-09-28:s-1:r2')
})

test('planCleaningTasks 为每个 (date, session) 生成任务并去重', () => {
  const rows = [
    { session_id: 's-1', date: '2026-09-28' },
    { session_id: 's-2', date: '2026-09-28' },
    { session_id: 's-1', date: '2026-09-28' },
  ]
  const tasks = planCleaningTasks(rows, '2026-09-29')
  assert.equal(tasks.length, 2)
  assert.deepEqual(tasks[0], { task_id: 'clean:2026-09-29:2026-09-28:s-1', session_id: 's-1', date: '2026-09-28' })
})
