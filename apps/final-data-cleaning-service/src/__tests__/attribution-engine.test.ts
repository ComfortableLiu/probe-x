/**
 * 归因引擎单元测试
 * 
 * 测试核心归因算法（computeAttribution）的各种场景：
 * - 单级页面导航归因
 * - 多级页面导航归因（累积传递）
 * - 回退导航场景
 * - 无归因事件场景
 * - 扩展归因参数
 * - 多 Session 隔离
 * - 空事件列表
 * 
 * 已知行为：
 * - attr_key 经 underlineToCamel 转换后保留 $ 前缀：$spm_a → $spmA
 * - 归因数组在 Map 中通过浅拷贝传递：多级导航时，各页面拥有独立的归因数组副本
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
  createBaseEvent,
  createAttributionEvent,
  createPageViewEvent,
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
      expect(result.attributionDataMap.size).toBe(0)
    })

    it('无归因事件应返回空归因数据，但事件透传', () => {
      const events = createNoAttributionScenario()
      const result = computeAttribution(events)

      expect(result.finalEvents).toHaveLength(3)
      expect(result.attributions).toHaveLength(0)
      expect(result.attributionDataMap.size).toBe(0)
    })

    it('单个归因事件（home → list）应生成 1 条归因记录', () => {
      const events = createHomepageToListScenario()
      const result = computeAttribution(events)

      expect(result.finalEvents).toHaveLength(5)
      expect(result.attributionDataMap.size).toBe(1)
      expect(result.attributionDataMap.has('page-product-list')).toBe(true)

      const listAttr = result.attributionDataMap.get('page-product-list')!
      expect(listAttr).toHaveLength(1)
      expect(listAttr[0].$spm_a).toBe('a001')
      expect(listAttr[0].$spm_b).toBe('b002')
      expect(listAttr[0].$spm_a_description).toBe('首页')
      expect(listAttr[0].$spm_b_description).toBe('导航')
    })

    it('单归因事件的 KV 展开后应包含正确的字段和格式', () => {
      const events = createHomepageToListScenario()
      const result = computeAttribution(events)

      const kvList = result.attributions
      expect(kvList.length).toBeGreaterThan(0)

      // underlineToCamel 转换保留 $ 前缀
      const keys = kvList.map(kv => kv.attr_key)
      expect(keys).toContain('$spmA')
      expect(keys).toContain('$spmB')
      expect(keys).toContain('$scmA')
      expect(keys).toContain('serviceTime')

      // source_page_id 是目标页面
      kvList.forEach(kv => {
        expect(kv.source_page_id).toBe('page-product-list')
      })
    })
  })

  describe('多级页面导航（累积归因传递）', () => {
    it('home → list → detail 应产生 2 个目标页面的归因 key', () => {
      const events = createMultiPageNavigationScenario()
      const result = computeAttribution(events)

      expect(result.finalEvents.length).toBeGreaterThan(0)
      expect(result.attributionDataMap.size).toBe(2)
      expect(result.attributionDataMap.has('page-product-list')).toBe(true)
      expect(result.attributionDataMap.has('page-product-detail')).toBe(true)
    })

    it('数组引用独立：多级导航中各页面拥有独立的归因数组', () => {
      // 修复后：get 取出数组时做浅拷贝，避免多级导航共享同一引用
      // 第 1 个归因事件：home→list，get('page-home')→[]，拷贝→[]，push→[A]，set('page-product-list', [A])
      // 第 2 个归因事件：list→detail，get('page-product-list')→[A]，拷贝→[A']，push→[A',B]，
      //   set('page-product-detail', [A',B])
      // 此时 page-product-list=[A]，page-product-detail=[A',B]，互不干扰
      const events = createMultiPageNavigationScenario()
      const result = computeAttribution(events)

      const listAttr = result.attributionDataMap.get('page-product-list')!
      const detailAttr = result.attributionDataMap.get('page-product-detail')!

      // list 只有自己的 1 条归因
      expect(listAttr).toHaveLength(1)
      // detail 有累积的 + 自己的共 2 条归因
      expect(detailAttr).toHaveLength(2)

      // 它们是不同的数组引用
      expect(listAttr).not.toBe(detailAttr)

      // list 的归因是 home→list
      expect(listAttr[0].$spm_b_description).toBe('导航')
      // detail 的第一条是 home→list 的累积，第二条是 list→detail
      expect(detailAttr[0].$spm_b_description).toBe('导航')
      expect(detailAttr[1].$spm_b_description).toBe('商品卡片')
    })

    it('detail 的 KV 应包含扩展归因参数（$product_id → $productId）', () => {
      const events = createMultiPageNavigationScenario()
      const result = computeAttribution(events)

      const detailKV = result.attributions.filter(
        kv => kv.source_page_id === 'page-product-detail'
      )
      const keys = detailKV.map(kv => kv.attr_key)
      expect(keys).toContain('$productId')
      expect(keys).toContain('$productName')

      const productIdKV = detailKV.find(kv => kv.attr_key === '$productId')
      expect(productIdKV?.attr_value).toBe('prod-001')
    })
  })

  describe('回退导航场景', () => {
    it('home → list，然后 home → detail：两个目标页面都应有归因数据', () => {
      const events = createBackAndForthScenario()
      const result = computeAttribution(events)

      expect(result.attributionDataMap.size).toBe(2)

      // home→list：get('page-home')→[]，push→[A]，set('page-product-list', [A])
      const listAttr = result.attributionDataMap.get('page-product-list')!
      expect(listAttr).toHaveLength(1)
      expect(listAttr[0].$spm_b_description).toBe('导航')

      // home→detail：get('page-home')→[]（home 不在 Map 中），push→[B]，
      //   set('page-product-detail', [B])
      const detailAttr = result.attributionDataMap.get('page-product-detail')!
      expect(detailAttr).toHaveLength(1)
      expect(detailAttr[0].$spm_b_description).toBe('推荐位')
    })
  })

  describe('扩展归因参数', () => {
    it('$ex_attribution_params 中的自定义字段应被包含在归因数据中', () => {
      const events = createExAttributionScenario()
      const result = computeAttribution(events)

      expect(result.attributionDataMap.size).toBe(1)
      expect(result.attributionDataMap.has('page-landing')).toBe(true)

      const landingKV = result.attributions.filter(
        kv => kv.source_page_id === 'page-landing'
      )
      const keys = landingKV.map(kv => kv.attr_key)

      expect(keys).toContain('$campaignId')
      expect(keys).toContain('$adGroup')
      expect(keys).toContain('$creativeId')
      expect(keys).toContain('$landingSource')

      const campaignKV = landingKV.find(kv => kv.attr_key === '$campaignId')
      expect(campaignKV?.attr_value).toBe('camp-2026-summer')
    })

    it('$session_id 不应泄漏到 $ex_attribution_params 的 KV 中', () => {
      const events = createExAttributionScenario()
      const result = computeAttribution(events)

      const landingKV = result.attributions.filter(
        kv => kv.source_page_id === 'page-landing'
      )
      const keys = landingKV.map(kv => kv.attr_key)
      expect(keys).not.toContain('$sessionId')
    })
  })

  describe('多 Session 隔离', () => {
    it('不同 session 分别计算归因时数据应正确分离', () => {
      const events = createMultiSessionScenario()

      const sessionAEvents = events.filter(e => e.$session_id === 'session-A')
      const sessionBEvents = events.filter(e => e.$session_id === 'session-B')

      const resultA = computeAttribution(sessionAEvents)
      const resultB = computeAttribution(sessionBEvents)

      expect(resultA.attributionDataMap.size).toBe(1)
      expect(resultA.attributionDataMap.has('page-product-list')).toBe(true)
      const listAttr = resultA.attributionDataMap.get('page-product-list')!
      expect(listAttr[0].$spm_a_description).toBe('首页-A')

      expect(resultB.attributionDataMap.size).toBe(1)
      expect(resultB.attributionDataMap.has('page-product-detail')).toBe(true)
      const detailAttr = resultB.attributionDataMap.get('page-product-detail')!
      expect(detailAttr[0].$spm_a_description).toBe('首页-B')
    })
  })

  describe('归因 KV 结构验证', () => {
    it('每个 KV 项应包含完整的必需字段', () => {
      const events = createHomepageToListScenario()
      const result = computeAttribution(events)

      result.attributions.forEach(kv => {
        expect(kv).toHaveProperty('source_page_id')
        expect(kv).toHaveProperty('attribution_index')
        expect(kv).toHaveProperty('attr_key')
        expect(kv).toHaveProperty('attr_value')
        expect(kv).toHaveProperty('event_time')

        expect(typeof kv.source_page_id).toBe('string')
        expect(typeof kv.attribution_index).toBe('number')
        expect(typeof kv.attr_key).toBe('string')
        expect(kv.event_time).toBeInstanceOf(Date)
      })
    })

    it('attr_key 应为 underlineToCamel 转换后的格式（保留 $ 前缀）', () => {
      const events = createHomepageToListScenario()
      const result = computeAttribution(events)

      const keys = new Set(result.attributions.map(kv => kv.attr_key))
      expect(keys).toContain('$spmA')
      expect(keys).toContain('$spmADescription')
      expect(keys).not.toContain('$spm_a')
      expect(keys).not.toContain('spm_a')
    })

    it('多归因项时 attribution_index 应递增', () => {
      const events = createMultiPageNavigationScenario()
      const result = computeAttribution(events)

      // page-product-detail 有 2 条归因项（累积传递）
      const detailKV = result.attributions.filter(
        kv => kv.source_page_id === 'page-product-detail'
      )
      const indices = new Set(detailKV.map(kv => kv.attribution_index))
      expect(indices.has(0)).toBe(true)
      expect(indices.has(1)).toBe(true)
    })
  })

  describe('修复验证', () => {
    it('数组引用独立：多级导航中各页面拥有独立的归因数组', () => {
      const events = createMultiPageNavigationScenario()
      const result = computeAttribution(events)

      const listArr = result.attributionDataMap.get('page-product-list')
      const detailArr = result.attributionDataMap.get('page-product-detail')

      // 它们是不同的数组引用
      expect(listArr).not.toBe(detailArr)

      // list 只有 1 条自己的归因
      expect(listArr).toHaveLength(1)
      // detail 有累积的 + 自己的共 2 条归因
      expect(detailArr).toHaveLength(2)

      const listKV = result.attributions.filter(kv => kv.source_page_id === 'page-product-list')
      const detailKV = result.attributions.filter(kv => kv.source_page_id === 'page-product-detail')

      // KV 展开后每个归因项产生多条 KV 记录（每个字段一条）
      // 按 attribution_index 去重计算归因项数
      const listIndices = new Set(listKV.map(kv => kv.attribution_index))
      const detailIndices = new Set(detailKV.map(kv => kv.attribution_index))

      // list 有 1 个归因项，detail 有 2 个归因项
      expect(listIndices.size).toBe(1)
      expect(detailIndices.size).toBe(2)
    })

    it('eventList 透传验证：finalEvents 应与输入完全一致', () => {
      const events = createMultiPageNavigationScenario()
      const result = computeAttribution(events)
      expect(result.finalEvents).toBe(events) // 同一引用
    })
  })
})
