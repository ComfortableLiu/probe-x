/**
 * DataSender 上报方式（transport）测试
 */

import { DataSender } from '../sender'
import { ConfigManager } from '../config'
import type { ProbeXEvent } from '../types'

const API_URL = 'http://localhost:3000/point/report'

// 构造一个最小可用的测试事件
const createEvent = (): ProbeXEvent => ({
  id: 'event-1',
  eventName: 'test_event',
  timestamp: Date.now(),
  logTime: new Date().toISOString(),
  page: {
    path: '/test',
    referrer: '',
  } as any,
  user: { user_id: 1 },
  device: {
    userAgent: 'test-agent',
    language: 'en-US',
    screen: { width: 1920, height: 1080, pixelRatio: 1 },
    viewport: { width: 1920, height: 1080 },
  } as any,
  properties: {},
  options: {},
  session: {} as any,
  sdk: {} as any,
})

// 模拟 Image：记录 src 赋值，并在下一个 tick 触发 onload/onerror；
// shouldFail 为 true 时触发 onerror，让 gifRequest reject，用于测试降级链
class MockImage {
  static urls: string[] = []
  static shouldFail = false
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  private _src = ''

  set src(url: string) {
    this._src = url
    MockImage.urls.push(url)
    setTimeout(() => {
      if (MockImage.shouldFail) {
        if (this.onerror) this.onerror()
      } else if (this.onload) {
        this.onload()
      }
    }, 0)
  }

  get src(): string {
    return this._src
  }
}

describe('DataSender transport 上报方式', () => {
  const sendBeaconMock = navigator.sendBeacon as jest.Mock
  const fetchMock = global.fetch as jest.Mock
  let senders: DataSender[] = []
  let originalImage: any

  const createSender = (transport?: 'beacon' | 'fetch' | 'gif', extraConfig: Record<string, any> = {}): DataSender => {
    const config = new ConfigManager({
      apiUrl: API_URL,
      appId: 'test-app',
      ...(transport ? { transport } : {}),
      ...extraConfig,
    })
    const sender = new DataSender(config)
    senders.push(sender)
    return sender
  }

  beforeEach(() => {
    const g = global as any
    originalImage = g.Image
    g.Image = MockImage
    MockImage.urls = []
    MockImage.shouldFail = false
  })

  afterEach(() => {
    const g = global as any
    g.Image = originalImage
    senders.forEach(sender => sender.destroy())
    senders = []
  })

  test('默认配置（不传 transport）flush 时调用 sendBeacon，不调用 fetch', async () => {
    const sender = createSender()

    sender.send(createEvent())
    await sender.flush()

    expect(sendBeaconMock).toHaveBeenCalledTimes(1)
    const [url, blob] = sendBeaconMock.mock.calls[0]
    expect(url).toBe(API_URL)
    expect(blob).toBeInstanceOf(Blob)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(sender.getQueueLength()).toBe(0)
  })

  test('transport 为 fetch 时调用 fetch，不调用 sendBeacon', async () => {
    const sender = createSender('fetch')

    sender.send(createEvent())
    await sender.flush()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe(API_URL)
    expect((options as RequestInit).method).toBe('POST')
    expect(sendBeaconMock).not.toHaveBeenCalled()
  })

  test('transport 为 gif 时直接走 gif 图片请求，不调用 fetch/sendBeacon', async () => {
    const sender = createSender('gif')

    sender.send(createEvent())
    await sender.flush()

    expect(MockImage.urls.length).toBe(1)
    expect(MockImage.urls[0]).toContain('http://localhost:3000/point/track.gif?')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(sendBeaconMock).not.toHaveBeenCalled()
  })

  test('transport 为 beacon 且 sendBeacon 返回 false 时降级到 gif', async () => {
    sendBeaconMock.mockReturnValueOnce(false)
    const sender = createSender('beacon')

    sender.send(createEvent())
    await sender.flush()

    expect(sendBeaconMock).toHaveBeenCalledTimes(1)
    expect(MockImage.urls.length).toBe(1)
    expect(MockImage.urls[0]).toContain('/point/track.gif?')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test('transport 为 beacon 且 sendBeacon、gif 均失败时降级到 fetch', async () => {
    sendBeaconMock.mockReturnValueOnce(false)
    MockImage.shouldFail = true
    const sender = createSender('beacon')

    sender.send(createEvent())
    await sender.flush()

    expect(sendBeaconMock).toHaveBeenCalledTimes(1)
    expect(MockImage.urls.length).toBe(1)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(sender.getQueueLength()).toBe(0)
  })

  test('transport 为 gif 且 gif 失败时降级到 sendBeacon', async () => {
    MockImage.shouldFail = true
    const sender = createSender('gif')

    sender.send(createEvent())
    await sender.flush()

    expect(MockImage.urls.length).toBe(1)
    expect(sendBeaconMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(sender.getQueueLength()).toBe(0)
  })

  test('transport 为 gif 且 URL 超长时降级到 sendBeacon，不发送裁剪数据', async () => {
    const sender = createSender('gif')
    const event = createEvent()
    // 构造超大属性，保证压缩后 URL 仍超过 2000 字符限制
    event.properties = { big: 'x'.repeat(5000) }

    sender.send(event)
    await sender.flush()

    // gif 未发出（没有 Image 请求），完整数据经 sendBeacon 上报
    expect(MockImage.urls.length).toBe(0)
    expect(sendBeaconMock).toHaveBeenCalledTimes(1)
    const [url, blob] = sendBeaconMock.mock.calls[0]
    expect(url).toBe(API_URL)
    expect(blob).toBeInstanceOf(Blob)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(sender.getQueueLength()).toBe(0)
  })

  test('allowFallback 为 false 时 gif 失败不降级，不调用 sendBeacon/fetch', async () => {
    MockImage.shouldFail = true
    const sender = createSender('gif', { allowFallback: false, maxRetries: 0 })

    sender.send(createEvent())
    await sender.flush()

    expect(MockImage.urls.length).toBe(1)
    expect(sendBeaconMock).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test('allowFallback 为 false 时 beacon 失败不降级，不调用 gif/fetch', async () => {
    sendBeaconMock.mockReturnValueOnce(false)
    const sender = createSender('beacon', { allowFallback: false, maxRetries: 0 })

    sender.send(createEvent())
    await sender.flush()

    expect(sendBeaconMock).toHaveBeenCalledTimes(1)
    expect(MockImage.urls.length).toBe(0)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test('allowFallback 为 false 且 gif URL 超长时保持原有行为，只发送关键数据', async () => {
    const sender = createSender('gif', { allowFallback: false })
    const event = createEvent()
    event.properties = { big: 'x'.repeat(5000) }

    sender.send(event)
    await sender.flush()

    expect(MockImage.urls.length).toBe(1)
    expect(MockImage.urls[0]).toContain('eventCount')
    expect(sendBeaconMock).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(sender.getQueueLength()).toBe(0)
  })

  test('flushSync 在 transport 为 gif 时不调用 sendBeacon，直接走 gif', () => {
    const sender = createSender('gif')

    sender.send(createEvent())
    sender.flushSync()

    expect(sendBeaconMock).not.toHaveBeenCalled()
    expect(MockImage.urls.length).toBe(1)
    expect(MockImage.urls[0]).toContain('/point/track.gif?')
    expect(sender.getQueueLength()).toBe(0)
  })

  test('flushSync 默认配置仍优先使用 sendBeacon', () => {
    const sender = createSender()

    sender.send(createEvent())
    sender.flushSync()

    expect(sendBeaconMock).toHaveBeenCalledTimes(1)
    expect(MockImage.urls.length).toBe(0)
    expect(sender.getQueueLength()).toBe(0)
  })
})
