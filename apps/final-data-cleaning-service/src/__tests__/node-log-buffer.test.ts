/**
 * node-log-buffer 单测
 *
 * 捕获器包装 console.* 为「原样透传 + 进待上行缓冲」，
 * 覆盖：级别映射、util.format 序列化、drain 语义、环形缓冲溢出、幂等安装与还原。
 */

import {
  drainNodeLogs,
  installNodeLogCapture,
  NODE_LOG_BUFFER_CAP,
  pendingNodeLogCount,
  resetNodeLogCapture,
} from '../lib/node-log-buffer'

describe('node-log-buffer 节点日志捕获缓冲', () => {
  // install 后 console.* 会被包装函数替换，断言透传要持有 mock 引用
  let logSpy: jest.SpyInstance

  beforeEach(() => {
    // 先 mock console 再安装捕获：捕获器记录的「原始输出」就是 mock，
    // 既能断言透传，又不污染测试输出
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
    jest.spyOn(console, 'info').mockImplementation(() => {})
    jest.spyOn(console, 'warn').mockImplementation(() => {})
    jest.spyOn(console, 'error').mockImplementation(() => {})
    jest.spyOn(console, 'debug').mockImplementation(() => {})
    installNodeLogCapture()
    drainNodeLogs(Infinity)
  })

  afterEach(() => {
    resetNodeLogCapture()
    jest.restoreAllMocks()
  })

  it('捕获 console.log 并原样透传', () => {
    console.log('任务', 't1', '开始执行')

    expect(logSpy).toHaveBeenCalledWith('任务', 't1', '开始执行')
    expect(pendingNodeLogCount()).toBe(1)

    const [entry] = drainNodeLogs()
    expect(entry.level).toBe('log')
    expect(entry.message).toBe('任务 t1 开始执行')
    expect(entry.ts).toBeGreaterThan(0)
  })

  it('各级别正确映射', () => {
    console.info('i')
    console.warn('w')
    console.error('e')
    console.debug('d')

    const entries = drainNodeLogs()
    expect(entries.map((entry) => entry.level)).toEqual(['info', 'warn', 'error', 'debug'])
  })

  it('支持 printf 占位、Error 与对象参数', () => {
    console.log('任务 %s 完成，耗时 %dms', 't1', 42)
    console.error(new Error('boom'))
    console.log('上下文', { a: 1 })

    const [formatted, withError, withObject] = drainNodeLogs()
    expect(formatted.message).toBe('任务 t1 完成，耗时 42ms')
    expect(withError.message).toContain('boom')
    expect(withObject.message).toContain('上下文')
    expect(withObject.message).toContain('a: 1')
  })

  it('drain 按时间序取出并清空缓冲', () => {
    console.log('first')
    console.log('second')

    const entries = drainNodeLogs()
    expect(entries.map((entry) => entry.message)).toEqual(['first', 'second'])
    expect(pendingNodeLogCount()).toBe(0)
  })

  it('drain 限量取出，剩余保留', () => {
    for (let i = 0; i < 5; i++) console.log(`msg-${i}`)

    const first = drainNodeLogs(2)
    expect(first.map((entry) => entry.message)).toEqual(['msg-0', 'msg-1'])
    expect(pendingNodeLogCount()).toBe(3)
  })

  it('缓冲溢出时丢弃最旧条目', () => {
    for (let i = 0; i < NODE_LOG_BUFFER_CAP + 10; i++) console.log(`msg-${i}`)

    expect(pendingNodeLogCount()).toBe(NODE_LOG_BUFFER_CAP)
    const entries = drainNodeLogs(Infinity)
    expect(entries[0].message).toBe('msg-10')
    expect(entries[entries.length - 1].message).toBe(`msg-${NODE_LOG_BUFFER_CAP + 9}`)
  })

  it('重复安装幂等，不会重复捕获', () => {
    installNodeLogCapture()
    installNodeLogCapture()

    console.log('only-once')
    expect(pendingNodeLogCount()).toBe(1)
  })

  it('reset 后不再捕获，console 恢复原样', () => {
    resetNodeLogCapture()

    console.log('not-captured')
    expect(pendingNodeLogCount()).toBe(0)
    // 输出仍透传到安装前绑定的实现（此处的 jest mock）
    expect(logSpy).toHaveBeenCalledWith('not-captured')
  })
})
