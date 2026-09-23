/**
 * 计算节点接入（NodeConnectionService）单测
 *
 * 这里刻意不碰 @GrpcStreamMethod：该装饰器在 ts-jest 下会改写方法签名
 * （见 helpers/testable-service.ts 的说明）。NodeConnectionService 把双向流抽象成
 * NodeCall 接口，测试注入 fake 即可覆盖「注册 / 心跳 / 任务进度 / 断线重连」全链路。
 *
 * 覆盖点：
 * 1. 连上后立即发 NodeRegister，NodeInfo 的 CPU / 内存字段为正数
 * 2. 心跳按间隔重复发送，任务执行期间 busy_task_id 正确置位
 * 3. 收到 ComputeTask → 执行清洗 → 回传的 ProgressUpdate 以 completed:true 收尾，node_id 一致
 * 4. 任务失败 → 回传 failed:true 且带 error
 * 5. 断线 → link 变 disconnected 并按退避重连，重连后重新注册
 * 6. 重复 task_id → Redis setNx 幂等，第二次不再执行
 */

import { ComputeNodeService } from '../service/node.service'
import { NodeConnectionService } from '../service/node-connection.service'
import { MockClickHouseService } from './mocks/clickhouse.service.mock'
import { createHomepageToListScenario, resetEventCounter } from './fixtures/event-factory'
import type { MasterFrame, NodeCall, NodeFrame, ProgressUpdate } from '../type'

/** 记录上行帧、可由测试驱动下行帧的 NodeCall 假实现 */
class FakeNodeCall implements NodeCall {
  readonly sent: NodeFrame[] = []
  closed = false

  private readonly frameHandlers: Array<(frame: MasterFrame) => void> = []
  private readonly closeHandlers: Array<() => void> = []
  private readonly errorHandlers: Array<(error: Error) => void> = []

  send(frame: NodeFrame): void {
    this.sent.push(frame)
  }

  onFrame(handler: (frame: MasterFrame) => void): void {
    this.frameHandlers.push(handler)
  }

  onClose(handler: () => void): void {
    this.closeHandlers.push(handler)
  }

  onError(handler: (error: Error) => void): void {
    this.errorHandlers.push(handler)
  }

  close(): void {
    this.closed = true
  }

  /** 测试侧：模拟总服务下发一帧 */
  emitFrame(frame: MasterFrame): void {
    this.frameHandlers.forEach((handler) => handler(frame))
  }

  /** 测试侧：模拟流正常关闭 */
  emitClose(): void {
    this.closeHandlers.forEach((handler) => handler())
  }

  /** 测试侧：模拟流报错 */
  emitError(error: Error): void {
    this.errorHandlers.forEach((handler) => handler(error))
  }

  /** 已发出的注册帧（sendRegister 每次发一条） */
  get registers(): NodeFrame[] {
    return this.sent.filter((frame) => frame.register)
  }

  /** 已发出的进度帧 */
  get progresses(): ProgressUpdate[] {
    return this.sent.map((frame) => frame.progress).filter(Boolean) as ProgressUpdate[]
  }
}

/** 覆写 createCall 注入假流，其余行为与生产完全一致 */
class TestableConnection extends NodeConnectionService {
  readonly calls: FakeNodeCall[] = []

  protected createCall(): NodeCall {
    const call = new FakeNodeCall()
    this.calls.push(call)
    return call
  }

  get currentCall(): FakeNodeCall {
    return this.calls[this.calls.length - 1]
  }
}

const fakeConfig = (values: Record<string, unknown>) =>
  ({
    get: (key: string) => values[key],
  }) as any

/** 让 insert 卡住，用于制造「任务执行中」的窗口 */
class GatedClickHouse extends MockClickHouseService {
  private gate: Promise<void> | null = null
  private openGate: (() => void) | null = null

  hold(): void {
    this.gate = new Promise<void>((resolve) => {
      this.openGate = resolve
    })
  }

  unhold(): void {
    this.openGate?.()
    this.gate = null
  }

  async insert(table: string, data: any[]): Promise<any> {
    if (this.gate && table === 'final_event_log') await this.gate
    return super.insert(table, data)
  }
}

/** insert 直接失败，用于制造任务失败 */
class FailingClickHouse extends MockClickHouseService {
  async insert(table: string, data: any[]): Promise<any> {
    throw new Error('ClickHouse 写入失败')
  }
}

/** 只认第一次 setNx 的假 Redis */
const fakeRedis = (firstTime: boolean) => {
  let called = false
  return {
    setNx: jest.fn(async () => {
      if (!called) {
        called = true
        return firstTime
      }
      return false
    }),
  } as any
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** 轮询等待条件成立，避免依赖具体时序 */
const waitFor = async (predicate: () => boolean, timeout = 3000): Promise<void> => {
  const deadline = Date.now() + timeout
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('等待条件超时')
    await sleep(5)
  }
}

const TASK = {
  task_id: 'task-node-conn-001',
  session_id: 'session-node-conn-001',
  date: '2026-06-01',
}

describe('计算节点接入 NodeConnectionService', () => {
  let mockCH: MockClickHouseService
  let nodeService: ComputeNodeService
  let connection: TestableConnection

  const boot = (options: {
    clickhouse?: any
    redis?: any
    config?: Record<string, unknown>
  } = {}) => {
    mockCH = options.clickhouse || new MockClickHouseService()
    nodeService = new ComputeNodeService(mockCH, options.redis)
    connection = new TestableConnection(
      nodeService,
      fakeConfig({
        'master.host': 'master.test',
        'master.port': 8105,
        'node.advertiseAddress': '10.0.0.8',
        'node.heartbeatIntervalMs': 5000,
        ...options.config,
      }),
    )
    connection.onApplicationBootstrap()
    return connection
  }

  beforeEach(() => {
    resetEventCounter()
    jest.spyOn(console, 'log').mockImplementation(() => {})
    jest.spyOn(console, 'warn').mockImplementation(() => {})
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    connection?.onModuleDestroy()
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  /** 模拟总服务接受接入（bindNode 命中后总会回一条 ACK） */
  const accept = (call: FakeNodeCall) => call.emitFrame({ ack: { accepted: true, message: 'ok' } })

  describe('注册与心跳', () => {
    it('连上后立即发 NodeRegister，NodeInfo 的 CPU/内存字段为正数', () => {
      boot()
      const call = connection.currentCall

      expect(call.registers).toHaveLength(1)

      const register = call.registers[0].register!
      expect(register.node_id).toBe(nodeService.nodeId)
      expect(register.node_name).toBe(nodeService.nodeName)
      expect(register.node_address).toBe('10.0.0.8')
      expect(register.version).toBeTruthy()

      expect(register.info!.cpu_count).toBeGreaterThan(0)
      expect(register.info!.memory_size).toBeGreaterThan(0)
      expect(register.info!.available_memory_size).toBeGreaterThanOrEqual(0)
      expect(register.info!.available).toBe(true)
      expect(register.info!.busy).toBe(false)
      expect(register.info!.busy_task_id).toBe('')
    })

    it('心跳按间隔重复发送，任务执行期间 busy_task_id 正确置位', async () => {
      const clickhouse = new GatedClickHouse()
      clickhouse.seedEventLog(createHomepageToListScenario(TASK.session_id))
      clickhouse.hold()

      boot({
        clickhouse,
        config: { 'node.heartbeatIntervalMs': 20 },
      })
      const call = connection.currentCall
      accept(call)

      call.emitFrame({ task: TASK })

      // 任务进入执行窗口（落库被卡住），此时心跳应上报忙碌
      const before = call.registers.length
      await sleep(80)
      const duringTask = call.registers.slice(before)
      expect(duringTask.length).toBeGreaterThanOrEqual(2)
      duringTask.forEach((frame) => {
        expect(frame.register!.info!.busy).toBe(true)
        expect(frame.register!.info!.busy_task_id).toBe(TASK.task_id)
      })

      // 放行落库，任务结束后心跳应恢复空闲
      clickhouse.unhold()
      await waitFor(() => nodeService.currentTaskId === '')

      const after = call.registers.length
      await sleep(50)
      const afterTask = call.registers.slice(after)
      expect(afterTask.length).toBeGreaterThanOrEqual(1)
      const last = afterTask[afterTask.length - 1].register!.info!
      expect(last.busy).toBe(false)
      expect(last.busy_task_id).toBe('')
    })
  })

  describe('任务执行', () => {
    it('收到 ComputeTask 后回传 ProgressUpdate，以 completed:true 收尾且 node_id 一致', async () => {
      const clickhouse = new MockClickHouseService()
      clickhouse.seedEventLog(createHomepageToListScenario(TASK.session_id))

      boot({ clickhouse })
      const call = connection.currentCall
      accept(call)

      call.emitFrame({ task: TASK })

      await waitFor(() => call.progresses.some((item) => item.completed))
      const progresses = call.progresses

      // 序列里每一条都属于同一个任务、同一个节点
      progresses.forEach((item) => {
        expect(item.task_id).toBe(TASK.task_id)
        expect(item.node_id).toBe(nodeService.nodeId)
        expect(item.failed).toBe(false)
        expect(item.error).toBe('')
      })

      // 先有「已接收」的起始进度，中间有处理进度，最后一条收尾
      expect(progresses[0].completed).toBe(false)
      expect(progresses[0].message).toContain('任务已接收')
      expect(progresses.length).toBeGreaterThan(1)

      const done = progresses[progresses.length - 1]
      expect(done.completed).toBe(true)
      expect(done.progress).toBe(done.target)
      expect(done.target).toBe(5)

      // 归因结果确实落了库
      const tables = clickhouse.insertLog.map((item) => item.table)
      expect(tables).toContain('final_event_log')
      expect(tables).toContain('event_attribution')

      // 任务结束后节点回到空闲
      await waitFor(() => nodeService.currentTaskId === '')
    })

    it('任务失败时回传 failed:true 且带 error', async () => {
      boot({ clickhouse: new FailingClickHouse() })
      const call = connection.currentCall
      accept(call)

      call.emitFrame({ task: TASK })

      await waitFor(() => call.progresses.some((item) => item.failed))
      const failed = call.progresses.find((item) => item.failed)!

      expect(failed.failed).toBe(true)
      expect(failed.completed).toBe(false)
      expect(failed.error).toBe('ClickHouse 写入失败')
      expect(failed.task_id).toBe(TASK.task_id)
      expect(failed.node_id).toBe(nodeService.nodeId)
      expect(nodeService.lastError).toBe('ClickHouse 写入失败')

      // 失败后节点不应卡在忙碌态
      await waitFor(() => nodeService.currentTaskId === '')
    })

    it('重复下发同一 task_id 时走 Redis 幂等，第二次不再执行', async () => {
      const clickhouse = new MockClickHouseService()
      clickhouse.seedEventLog(createHomepageToListScenario(TASK.session_id))
      const redis = fakeRedis(true)

      boot({ clickhouse, redis })
      const call = connection.currentCall
      accept(call)

      call.emitFrame({ task: TASK })
      await waitFor(() => call.progresses.some((item) => item.completed))

      const writesAfterFirst = clickhouse.insertLog.length
      expect(writesAfterFirst).toBeGreaterThan(0)

      // 总服务重放同一 task_id：setNx 返回 false，直接标记完成，不再落库
      call.emitFrame({ task: TASK })
      await waitFor(() => call.progresses.filter((item) => item.completed).length >= 2)

      expect(redis.setNx).toHaveBeenCalledTimes(2)
      expect(redis.setNx).toHaveBeenCalledWith(`clean:task:${TASK.task_id}`, '1', 86400)

      const replay = call.progresses.filter((item) => item.completed).pop()!
      expect(replay.message).toContain('重复下发')
      expect(replay.target).toBe(0)
      expect(clickhouse.insertLog.length).toBe(writesAfterFirst)
    })
  })

  describe('断线重连', () => {
    it('断线后 link 变 disconnected 并按退避重连，重连后重新注册', async () => {
      jest.useFakeTimers()

      boot()
      const first = connection.currentCall
      accept(first)
      expect(connection.linkStatus).toBe('connected')
      expect(connection.connectedAt).toBeGreaterThan(0)

      first.emitClose()
      expect(connection.linkStatus).toBe('disconnected')
      expect(connection.connectedAt).toBeNull()
      expect(connection.getSnapshot().lastError).toBeTruthy()
      expect(connection.calls).toHaveLength(1)

      // 退避 1s 起步：1s 之内不该重连
      await jest.advanceTimersByTimeAsync(900)
      expect(connection.calls).toHaveLength(1)

      await jest.advanceTimersByTimeAsync(200)
      expect(connection.calls).toHaveLength(2)

      // 重连后重新发起注册
      const second = connection.currentCall
      expect(second).not.toBe(first)
      expect(first.closed).toBe(true)
      expect(second.registers).toHaveLength(1)
      expect(second.registers[0].register!.node_id).toBe(nodeService.nodeId)

      // 总服务回帧后链接才算建立
      accept(second)
      expect(connection.linkStatus).toBe('connected')
    })

    it('总服务不可达时退避按 1s→2s→… 递增，不会退化成固定 1s', async () => {
      jest.useFakeTimers()

      boot()

      // 连续 4 次握手失败（gRPC 建流成功但对端从不回帧，随后流报错）
      const attempt = async () => {
        const call = connection.currentCall
        call.emitError(new Error('14 UNAVAILABLE: No connection established'))
        expect(connection.linkStatus).toBe('disconnected')
      }

      await attempt()
      // 第 1 次退避 1s
      await jest.advanceTimersByTimeAsync(1000)
      expect(connection.calls).toHaveLength(2)

      await attempt()
      // 第 2 次退避 2s：1s 时还不该重连
      await jest.advanceTimersByTimeAsync(1500)
      expect(connection.calls).toHaveLength(2)
      await jest.advanceTimersByTimeAsync(500)
      expect(connection.calls).toHaveLength(3)

      await attempt()
      // 第 3 次退避 4s
      await jest.advanceTimersByTimeAsync(3500)
      expect(connection.calls).toHaveLength(3)
      await jest.advanceTimersByTimeAsync(500)
      expect(connection.calls).toHaveLength(4)

      await attempt()
      // 第 4 次退避 8s
      await jest.advanceTimersByTimeAsync(7500)
      expect(connection.calls).toHaveLength(4)
      await jest.advanceTimersByTimeAsync(500)
      expect(connection.calls).toHaveLength(5)

      // 四次退避分别是 1s/2s/4s/8s，上面已逐段验证；此处确认全程从未真正连上过
      expect(connection.connectedAt).toBeNull()
      expect(connection.linkStatus).not.toBe('connected')
    })

    it('同一链接的 end / close 只触发一次重连', async () => {
      jest.useFakeTimers()

      boot()
      const call = connection.currentCall
      accept(call)

      call.emitClose()
      call.emitClose()
      call.emitError(new Error('后到的错误'))

      await jest.advanceTimersByTimeAsync(1500)
      expect(connection.calls).toHaveLength(2)
    })
  })
})
