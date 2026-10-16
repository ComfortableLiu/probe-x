/**
 * 归因引擎单元测试
 *
 * 测试核心归因算法（computeAttribution）的各种场景：
 * - 归因事件的扩展参数 KV 展开
 * - 无扩展参数的事件不产生 KV 行
 * - 非法 JSON / 对象形式入参的容错
 * - 多事件独立性（无链式累积、无同目标覆盖）
 * - 多 Session 隔离
 * - 空事件列表
 *
 * 已知行为：
 * - attr_key 经 underlineToCamel 转换后保留 $ 前缀：$product_id → $productId
 * - KV 子表只存归因事件自身 $ex_attribution_params 的动态归因属性，
 *   归因链由查询侧按 session 内时间前缀动态拼装
 * - SPM/SCM 标准字段已是 final_event_log 的列，不写入 KV 子表
 */

import { computeAttribution } from '../lib/attribution-engine'
import {
  resetEventCounter,
  createHomepageToListScenario,
  createMultiPageNavigationScenario,
  createBackAndForthScenario,
  createNoAttributionScenario,
  createExAttributionScenario,
  createMultiSessionScenario,
  createHighVolumeScenario,
  createBaseEvent,
  createAttributionEvent,
} from './fixtures/event-factory'

describe('归因引擎 - 核心算法', () => {
  beforeEach(() => {
    resetEventCounter()
  })

  describe('基础场景', () => {
    it('空事件列表应返回空结果', () => {
      const result = computeAttribution([])
      expect(result.finalEvents).toHaveLength(0)
      expect(result.attributions).toHaveLength(0)
    })

    it('无归因事件应返回空归因数据，但事件透传', () => {
      const events = createNoAttributionScenario()
      const result = computeAttribution(events)

      expect(result.finalEvents).toHaveLength(3)
      expect(result.attributions).toHaveLength(0)
    })

    it('无扩展参数的归因事件不产生 KV 行，事件透传', () => {
      const events = createHomepageToListScenario()
      const result = computeAttribution(events)

      expect(result.finalEvents).toHaveLength(5)
      expect(result.attributions).toHaveLength(0)
    })

    it('有扩展参数的归因事件只展开自己的扩展参数为 KV 行', () => {
      const events = createMultiPageNavigationScenario()
      const result = computeAttribution(events)

      // 两个归因事件中只有 list → detail 携带扩展参数（$product_id / $product_name）
      const detailEvent = events.find(
        e => e.$is_attribution_event && e.$target_page_id === 'page-product-detail',
      )!

      expect(result.attributions).toHaveLength(2)
      result.attributions.forEach(kv => {
        expect(kv.event_id).toBe(detailEvent.$event_id)
        expect(kv.session_id).toBe(detailEvent.$session_id)
        expect(kv.event_time).toBe(detailEvent.$service_time)
      })

      const keys = result.attributions.map(kv => kv.attr_key)
      expect(keys).toContain('$productId')
      expect(keys).toContain('$productName')

      const productIdKV = result.attributions.find(kv => kv.attr_key === '$productId')
      expect(productIdKV?.attr_value).toBe('prod-001')
    })
  })

  describe('KV 行内容约束', () => {
    it('SPM/SCM 标准字段不写入 KV 子表', () => {
      const events = createExAttributionScenario()
      const result = computeAttribution(events)

      const keys = result.attributions.map(kv => kv.attr_key)
      expect(keys).not.toContain('$spm')
      expect(keys).not.toContain('$spmA')
      expect(keys).not.toContain('$scm')
      expect(keys).not.toContain('$scmA')
    })

    it('serviceTime 不应泄漏为 attr 行', () => {
      const events = createExAttributionScenario()
      const result = computeAttribution(events)

      const keys = result.attributions.map(kv => kv.attr_key)
      expect(keys).not.toContain('serviceTime')
    })

    it('$session_id 不应泄漏到扩展参数的 KV 中（只出现在 session_id 列上）', () => {
      const events = createExAttributionScenario()
      const result = computeAttribution(events)

      const keys = result.attributions.map(kv => kv.attr_key)
      expect(keys).not.toContain('$sessionId')
      result.attributions.forEach(kv => {
        expect(kv.session_id).toBe('session-001')
      })
    })

    it('所有值统一 String() 转换', () => {
      const events = createHighVolumeScenario('session-hv', 10)
      const result = computeAttribution(events)

      expect(result.attributions.length).toBeGreaterThan(0)
      result.attributions.forEach(kv => {
        expect(typeof kv.attr_value).toBe('string')
      })
      // 工厂里 $event_index 是 number，展开后应是字符串
      const first = result.attributions.find(kv => kv.attr_key === '$eventIndex')
      expect(first).toBeDefined()
      expect(first!.attr_value).toBe('0')
    })

    it('attr_key 应为 underlineToCamel 转换后的格式（保留 $ 前缀）', () => {
      const events = createExAttributionScenario()
      const result = computeAttribution(events)

      const keys = new Set(result.attributions.map(kv => kv.attr_key))
      expect(keys).toContain('$campaignId')
      expect(keys).toContain('$adGroup')
      expect(keys).toContain('$creativeId')
      expect(keys).toContain('$landingSource')
      expect(keys).not.toContain('$campaign_id')
    })

    it('每个 KV 项应包含完整的必需字段', () => {
      const events = createExAttributionScenario()
      const result = computeAttribution(events)

      expect(result.attributions.length).toBeGreaterThan(0)
      result.attributions.forEach(kv => {
        expect(typeof kv.event_id).toBe('string')
        expect(typeof kv.session_id).toBe('string')
        expect(typeof kv.attr_key).toBe('string')
        expect(typeof kv.attr_value).toBe('string')
        expect(kv.event_time).toBeInstanceOf(Date)
      })
    })
  })

  describe('$ex_attribution_params 解析容错', () => {
    it('非法 JSON 字符串应被容忍，不产生 KV 行', () => {
      const event = createBaseEvent({
        $is_attribution_event: true,
        $target_page_id: 'page-x',
        $ex_attribution_params: '{invalid json',
      })
      const result = computeAttribution([event])
      expect(result.attributions).toHaveLength(0)
    })

    it('空字符串 / 空对象 JSON 不产生 KV 行', () => {
      const emptyStr = createBaseEvent({
        $is_attribution_event: true,
        $target_page_id: 'page-x',
        $ex_attribution_params: '',
      })
      const emptyObj = createBaseEvent({
        $is_attribution_event: true,
        $target_page_id: 'page-y',
        $ex_attribution_params: '{}',
      })
      const result = computeAttribution([emptyStr, emptyObj])
      expect(result.attributions).toHaveLength(0)
    })

    it('上游传入的已是对象时直接使用', () => {
      const event = createBaseEvent({
        $is_attribution_event: true,
        $target_page_id: 'page-x',
        $ex_attribution_params: { $campaign_id: 'camp-obj' },
      })
      const result = computeAttribution([event])

      expect(result.attributions).toHaveLength(1)
      expect(result.attributions[0].attr_key).toBe('$campaignId')
      expect(result.attributions[0].attr_value).toBe('camp-obj')
      expect(result.attributions[0].event_id).toBe(event.$event_id)
      expect(result.attributions[0].session_id).toBe(event.$session_id)
    })

    it('JSON 字符串（与 ClickHouse 实际存储一致）应被正确解析', () => {
      const event = createAttributionEvent('page-home', 'page-landing', {}, {}, {
        $campaign_id: 'camp-2026-summer',
      })
      // 工厂应以 JSON 字符串形式存储（与 ClickHouse 实际存储一致）
      expect(typeof (event as any).$ex_attribution_params).toBe('string')

      const result = computeAttribution([event])
      expect(result.attributions).toHaveLength(1)
      expect(result.attributions[0].attr_key).toBe('$campaignId')
      expect(result.attributions[0].attr_value).toBe('camp-2026-summer')
    })

    it('非归因事件（$is_attribution_event = false）即使携带扩展参数也不产生 KV 行', () => {
      const event = createBaseEvent({
        $is_attribution_event: false,
        $target_page_id: 'page-x',
        $ex_attribution_params: JSON.stringify({ $campaign_id: 'camp-x' }),
      })
      const result = computeAttribution([event])
      expect(result.attributions).toHaveLength(0)
    })
  })

  describe('多事件独立性（无链式累积 / 无同目标覆盖）', () => {
    it('同目标页的多个归因事件各自产生自己的 KV 行（按 event_id 区分）', () => {
      const e1 = createAttributionEvent('page-a', 'page-x', {}, {}, { $nav_position: 'top-menu' })
      const e2 = createAttributionEvent('page-b', 'page-x', {}, {}, { $nav_position: 'recommend' })
      const result = computeAttribution([e1, e2])

      expect(result.attributions).toHaveLength(2)

      const kv1 = result.attributions.find(kv => kv.event_id === e1.$event_id)!
      const kv2 = result.attributions.find(kv => kv.event_id === e2.$event_id)!
      expect(kv1.attr_key).toBe('$navPosition')
      expect(kv1.attr_value).toBe('top-menu')
      expect(kv2.attr_value).toBe('recommend')
    })

    it('回退导航：两个归因事件各自产生自己的 KV 行，互不累积', () => {
      const events = createBackAndForthScenario()
      const result = computeAttribution(events)

      const attrEvents = events.filter(e => e.$is_attribution_event)
      expect(attrEvents).toHaveLength(2)
      expect(result.attributions).toHaveLength(2)

      attrEvents.forEach(event => {
        const kvs = result.attributions.filter(kv => kv.event_id === event.$event_id)
        expect(kvs).toHaveLength(1)
        expect(kvs[0].attr_key).toBe('$navPosition')
        expect(kvs[0].session_id).toBe(event.$session_id)
        expect(kvs[0].event_time).toBe(event.$service_time)
      })
    })

    it('多级导航：归因事件之间不传递扩展参数', () => {
      const events = createMultiPageNavigationScenario()
      const result = computeAttribution(events)

      // home → list 事件无扩展参数，不产生行；
      // list → detail 只产生自己的 $productId/$productName，不含任何来自其他事件的参数
      const keys = new Set(result.attributions.map(kv => kv.attr_key))
      expect(keys.size).toBe(2)
      expect(keys.has('$productId')).toBe(true)
      expect(keys.has('$productName')).toBe(true)
    })
  })

  describe('多 Session 隔离', () => {
    it('不同 session 分别计算归因时，KV 行携带各自的 session_id', () => {
      const events = createMultiSessionScenario()

      const sessionAEvents = events.filter(e => e.$session_id === 'session-A')
      const sessionBEvents = events.filter(e => e.$session_id === 'session-B')

      const resultA = computeAttribution(sessionAEvents)
      const resultB = computeAttribution(sessionBEvents)

      expect(resultA.attributions).toHaveLength(1)
      resultA.attributions.forEach(kv => {
        expect(kv.session_id).toBe('session-A')
        expect(kv.attr_key).toBe('$campaignId')
        expect(kv.attr_value).toBe('camp-A')
      })

      expect(resultB.attributions).toHaveLength(1)
      resultB.attributions.forEach(kv => {
        expect(kv.session_id).toBe('session-B')
        expect(kv.attr_key).toBe('$campaignId')
        expect(kv.attr_value).toBe('camp-B')
      })
    })
  })

  describe('透传与进度', () => {
    it('单事件包含 200000 个扩展属性时完整保留 KV 行和顺序，不受函数实参数量限制', () => {
      const attributeCount = 200000
      const params: Record<string, number> = {}
      for (let index = 0; index < attributeCount; index += 1) {
        params[`$attribute_${index}`] = index
      }
      const event = createBaseEvent({
        $is_attribution_event: true,
        $target_page_id: 'page-large-attributes',
        $ex_attribution_params: JSON.stringify(params),
      })
      const events = [event]
      const progress = jest.fn()

      const result = computeAttribution(events, progress)

      expect(result.finalEvents).toBe(events)
      expect(result.attributions).toHaveLength(attributeCount)
      expect(result.attributions.every((row, index) => (
        row.attr_key === `$attribute_${index}`
        && row.attr_value === String(index)
        && row.event_id === event.$event_id
        && row.session_id === event.$session_id
        && row.event_time === event.$service_time
      ))).toBe(true)
      expect(progress).toHaveBeenCalledTimes(1)
      expect(progress).toHaveBeenCalledWith(1, 1)
    })

    it('eventList 透传验证：finalEvents 应与输入完全一致', () => {
      const events = createMultiPageNavigationScenario()
      const result = computeAttribution(events)
      expect(result.finalEvents).toBe(events) // 同一引用
    })

    it('onProgress 应逐事件回调', () => {
      const events = createNoAttributionScenario()
      const calls: Array<[number, number]> = []
      computeAttribution(events, (processed, total) => calls.push([processed, total]))

      expect(calls).toHaveLength(events.length)
      expect(calls[calls.length - 1]).toEqual([events.length, events.length])
    })
  })
})
