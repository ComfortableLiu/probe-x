/**
 * AutoTracker 自动埋点跟踪器测试
 */

import { AutoTracker } from '../auto-tracker'
import { ConfigManager } from '../config'
import { EventCollector } from '../collector'

describe('AutoTracker', () => {
  // getElementSelector / getElementInfo 不依赖实例状态，直接通过原型调用，避免构造 config/collector
  const getElementSelector = (element: Element): string =>
    (AutoTracker.prototype as any).getElementSelector.call(AutoTracker.prototype, element)
  const getElementInfo = (element: Element) =>
    (AutoTracker.prototype as any).getElementInfo.call(AutoTracker.prototype, element)

  const createTracker = (options: Record<string, any> = {}) => {
    const config = new ConfigManager({ appId: 'test-app', ...options })
    const collector = new EventCollector(config)
    return new AutoTracker(config, collector)
  }

  afterEach(() => {
    document.body.innerHTML = ''
  })

  /**
   * 构造嵌套 DOM：div 内嵌带 class 的 svg（模拟 Ant Design InputNumber 的「+」按钮内嵌 SVG）
   */
  const buildNestedDom = () => {
    const wrapper = document.createElement('div')
    wrapper.className = 'ant-input-number'
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('class', 'anticon anticon-plus')
    wrapper.appendChild(svg)
    document.body.appendChild(wrapper)
    return { wrapper, svg }
  }

  describe('getElementSelector', () => {
    test('前置条件：jsdom 中 SVG 元素的 className 是 SVGAnimatedString 对象（与浏览器一致）', () => {
      const { svg } = buildNestedDom()
      expect(typeof svg.className).toBe('object')
      expect((svg.className as unknown as SVGAnimatedString).baseVal).toBe('anticon anticon-plus')
    })

    test('SVG 元素不应抛出 TypeError，且选择器包含 svg 的类名', () => {
      const { svg } = buildNestedDom()
      let selector = ''
      expect(() => {
        selector = getElementSelector(svg)
      }).not.toThrow()
      expect(selector).toContain('svg.anticon.anticon-plus')
      expect(selector).toBe('div.ant-input-number > svg.anticon.anticon-plus')
    })

    test('HTML 元素的选择器行为保持不变', () => {
      const { wrapper } = buildNestedDom()
      expect(getElementSelector(wrapper)).toBe('div.ant-input-number')
    })

    test('无类名元素不应拼接多余的点', () => {
      const div = document.createElement('div')
      const span = document.createElement('span')
      div.appendChild(span)
      document.body.appendChild(div)
      expect(getElementSelector(span)).toBe('div > span')
    })
  })

  describe('getElementInfo', () => {
    test('SVG 元素的 className 应归一化为字符串而非 SVGAnimatedString 对象', () => {
      const { svg } = buildNestedDom()
      const info = getElementInfo(svg)
      expect(typeof info.className).toBe('string')
      expect(info.className).toBe('anticon anticon-plus')
    })

    test('无类名元素的 className 应为 null', () => {
      const div = document.createElement('div')
      document.body.appendChild(div)
      expect(getElementInfo(div).className).toBeNull()
    })
  })

  describe('密码字段脱敏', () => {
    test('点击密码输入框产生的事件 element_value 不包含明文', () => {
      const tracker = createTracker()
      const trackerAny = tracker as any
      trackerAny.trackClicks()

      const input = document.createElement('input')
      input.type = 'password'
      input.name = 'password'
      input.value = 'super-secret-password'
      document.body.appendChild(input)

      const events: any[] = []
      const listener = (e: Event) => events.push((e as CustomEvent).detail)
      window.addEventListener('probe-x-event', listener)

      input.dispatchEvent(new MouseEvent('click', { bubbles: true }))

      expect(events).toHaveLength(1)
      expect(events[0].eventName).toBe('click')
      expect(events[0].properties.element_value).toBeNull()
      expect(JSON.stringify(events[0].properties)).not.toContain('super-secret-password')

      window.removeEventListener('probe-x-event', listener)
      tracker.stop()
    })

    test('maskSensitiveData 为 false 时密码框仍被脱敏，其他敏感类型仍受配置控制', () => {
      const tracker = createTracker({ maskSensitiveData: false })
      const trackerAny = tracker as any

      const passwordInput = document.createElement('input')
      passwordInput.type = 'password'
      passwordInput.value = 'super-secret-password'
      expect(trackerAny.maskFieldValue(passwordInput)).toBe('***')

      const emailInput = document.createElement('input')
      emailInput.type = 'email'
      emailInput.value = 'user@example.com'
      expect(trackerAny.maskFieldValue(emailInput)).toBe('user@example.com')
    })
  })

  describe('采集事件转发', () => {
    test('fetch 请求触发 network_request 后会在 window 上 dispatch probe-x-event 事件', async () => {
      const mockFetch = window.fetch as jest.Mock
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: () => null },
      })

      const tracker = createTracker()
      const trackerAny = tracker as any
      trackerAny.trackNetworkRequests()

      const events: any[] = []
      const listener = (e: Event) => events.push((e as CustomEvent).detail)
      window.addEventListener('probe-x-event', listener)

      await window.fetch('http://example.com/api/data')

      const networkEvents = events.filter(e => e.eventName === 'network_request')
      expect(networkEvents).toHaveLength(1)
      expect(networkEvents[0].properties.url).toBe('http://example.com/api/data')
      expect(networkEvents[0].properties.status).toBe(200)

      window.removeEventListener('probe-x-event', listener)
      tracker.stop()
    })
  })
})
