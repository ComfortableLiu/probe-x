/**
 * ProbeX SDK 主要功能测试
 */

import ProbeX from '../index'

describe('ProbeX SDK', () => {
  let probeX: ProbeX

  beforeEach(() => {
    // 清理 localStorage
    localStorage.clear()

    // 创建 SDK 实例
    probeX = new ProbeX({
      apiUrl: 'http://localhost:3000/point/report',
      appId: 'test-app',
      debug: true,
      autoTrack: false, // 测试时关闭自动埋点
    })
  })

  afterEach(() => {
    if (probeX) {
      probeX.destroy()
    }
  })

  describe('初始化', () => {
    test('应该正确初始化SDK', () => {
      expect(probeX).toBeDefined()
      expect(probeX.getConfig('apiUrl')).toBe('http://localhost:3000/point/report')
      expect(probeX.getConfig('appId')).toBe('test-app')
      expect(probeX.getConfig('debug')).toBe(true)
    })

    test('应该生成会话ID和设备ID', () => {
      const session = probeX.getSession()
      expect(session.id).toBeDefined()
      expect(typeof session.id).toBe('string')
      expect(session.id.length).toBeGreaterThan(0)
    })
  })

  describe('配置管理', () => {
    test('应该能够设置和获取配置', () => {
      probeX.setConfig('testKey', 'testValue')
      expect(probeX.getConfig('testKey')).toBe('testValue')
    })

    test('应该返回默认值当配置不存在时', () => {
      expect(probeX.getConfig('nonExistentKey', 'defaultValue')).toBe('defaultValue')
    })
  })

  describe('用户属性', () => {
    test('应该能够设置用户属性', () => {
      const userProps = {
        user_id: '12345',
        user_name: 'Test User',
        email: 'test@example.com',
      }

      probeX.setUser(userProps)

      const config = probeX.getConfig('userProperties')
      expect(config).toMatchObject(userProps)
    })

    test('应该能够合并用户属性', () => {
      probeX.setUser({ user_id: '12345' })
      probeX.setUser({ user_name: 'Test User' })

      const config = probeX.getConfig('userProperties')
      expect(config).toMatchObject({
        user_id: '12345',
        user_name: 'Test User',
      })
    })
  })

  describe('全局属性', () => {
    test('应该能够设置全局属性', () => {
      const globalProps = {
        app_version: '1.0.0',
        environment: 'test',
      }

      probeX.setGlobalProperties(globalProps)

      const config = probeX.getConfig('globalProperties')
      expect(config).toMatchObject(globalProps)
    })
  })

  describe('手动埋点', () => {
    beforeEach(() => {
      // 不 mock performance，fake-timers 的 performance 缺少 getEntriesByType 会导致 collectEvent 失败
      jest.useFakeTimers({ doNotFake: ['performance'] })
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    test('应该能够发送基础事件', () => {
      // 手动 track 走 collector → sender 链路，不派发 probe-x-event（那是 auto-tracker 的转发通道）
      const sendSpy = jest.spyOn((probeX as any).sender, 'send')

      probeX.track('test_event', {
        test_property: 'test_value',
      })

      // track 是同步入队，flush 走定时器；推进定时器验证无异步副作用
      jest.advanceTimersByTime(0)

      expect(sendSpy).toHaveBeenCalled()
      const event = sendSpy.mock.calls[0][0]
      expect(event.eventName).toBe('test_event')
      expect(event.properties.test_property).toBe('test_value')
    })

    test('应该包含全局属性在事件中', () => {
      probeX.setGlobalProperties({
        app_version: '1.0.0',
      })

      const sendSpy = jest.spyOn((probeX as any).sender, 'send')

      probeX.track('test_event', {
        test_property: 'test_value',
      })

      jest.advanceTimersByTime(0)

      expect(sendSpy).toHaveBeenCalled()
      const event = sendSpy.mock.calls[0][0]
      expect(event.properties.app_version).toBe('1.0.0')
      expect(event.properties.test_property).toBe('test_value')
    })

    test('发送的事件应该携带唯一 $event_id 且重试时不变', () => {
      const sendSpy = jest.spyOn((probeX as any).sender, 'send')

      probeX.track('test_event', {})

      jest.advanceTimersByTime(0)

      expect(sendSpy).toHaveBeenCalled()
      const event = sendSpy.mock.calls[0][0]
      const sender = (probeX as any).sender
      const prepared = sender.prepareEvent(event)

      expect(typeof prepared.$event_id).toBe('string')
      expect(prepared.$event_id.length).toBeGreaterThan(0)
      // 同一事件重复准备（重试/重发场景）$event_id 必须保持稳定
      expect(sender.prepareEvent(event).$event_id).toBe(prepared.$event_id)
    })
  })

  describe('会话管理', () => {
    test('应该返回会话信息', () => {
      const session = probeX.getSession()

      expect(session).toHaveProperty('id')
      expect(session).toHaveProperty('startTime')
      expect(session).toHaveProperty('duration')
      expect(typeof session.id).toBe('string')
      expect(typeof session.startTime).toBe('number')
      expect(typeof session.duration).toBe('number')
    })
  })

  describe('工具方法', () => {
    test('应该返回用户代理信息', () => {
      const userAgent = probeX.getUserAgent()
      expect(typeof userAgent).toBe('string')
      expect(userAgent.length).toBeGreaterThan(0)
    })

    test('应该返回页面信息', () => {
      const pageInfo = probeX.getPageInfo()
      expect(pageInfo).toHaveProperty('title')
      expect(pageInfo).toHaveProperty('url')
      expect(pageInfo).toHaveProperty('path')
    })

    test('应该返回屏幕信息', () => {
      const screenInfo = probeX.getScreenInfo()
      expect(screenInfo).toHaveProperty('width')
      expect(screenInfo).toHaveProperty('height')
    })

    test('应该返回浏览器信息', () => {
      const browserInfo = probeX.getBrowserInfo()
      expect(browserInfo).toHaveProperty('userAgent')
      expect(browserInfo).toHaveProperty('language')
      expect(browserInfo).toHaveProperty('platform')
    })
  })

  describe('销毁', () => {
    test('应该能够正确销毁SDK', () => {
      const consoleSpy = jest.spyOn(console, 'log')

      probeX.destroy()

      expect(consoleSpy).toHaveBeenCalledWith('ProbeX SDK destroyed')

      consoleSpy.mockRestore()
    })
  })
})
