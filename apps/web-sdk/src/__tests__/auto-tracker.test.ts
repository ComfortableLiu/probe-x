/**
 * AutoTracker 自动埋点跟踪器测试
 */

import { AutoTracker } from '../auto-tracker'

describe('AutoTracker', () => {
  // getElementSelector / getElementInfo 不依赖实例状态，直接通过原型调用，避免构造 config/collector
  const getElementSelector = (element: Element): string =>
    (AutoTracker.prototype as any).getElementSelector.call(AutoTracker.prototype, element)
  const getElementInfo = (element: Element) =>
    (AutoTracker.prototype as any).getElementInfo.call(AutoTracker.prototype, element)

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
})
