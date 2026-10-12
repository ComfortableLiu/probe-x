/**
 * 页面追踪字段（$page_id/$source_page_id）与归因事件标记测试
 */

import { EventCollector } from '../collector'
import { DataSender } from '../sender'
import { ConfigManager } from '../config'
import { PageTracker } from '../page-tracker'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

const createCollector = (extraConfig: Record<string, any> = {}): EventCollector => {
  const config = new ConfigManager({
    apiUrl: 'http://localhost:3000/point/report',
    appId: 'test-app',
    storageType: 'memory',
    ...extraConfig,
  })
  return new EventCollector(config)
}

describe('PageTracker', () => {
  test('初始时当前/上一页面浏览 id 均为空串', () => {
    const tracker = new PageTracker()
    expect(tracker.getPageId()).toBe('')
    expect(tracker.getSourcePageId()).toBe('')
  })

  test('首次 rotate 生成新 uuid，上一页面 id 为 ""', () => {
    const tracker = new PageTracker()
    const id = tracker.rotate()
    expect(id).toMatch(UUID_PATTERN)
    expect(tracker.getPageId()).toBe(id)
    expect(tracker.getSourcePageId()).toBe('')
  })

  test('再次 rotate 轮换：source 为上一次 page id，page id 更新且不同', () => {
    const tracker = new PageTracker()
    const first = tracker.rotate()
    const second = tracker.rotate()
    expect(second).toMatch(UUID_PATTERN)
    expect(second).not.toBe(first)
    expect(tracker.getPageId()).toBe(second)
    expect(tracker.getSourcePageId()).toBe(first)
  })
})

describe('EventCollector 页面追踪字段注入', () => {
  test('首个 page_view 携带新 $page_id，$source_page_id 为 ""', () => {
    const collector = createCollector()
    const event = collector.collectEvent('page_view')

    expect(event).not.toBeNull()
    expect(event!.properties.$page_id).toMatch(UUID_PATTERN)
    expect(event!.properties.$source_page_id).toBe('')
  })

  test('page_view 之前的事件携带空串 $page_id/$source_page_id', () => {
    const collector = createCollector()
    const event = collector.collectEvent('click')

    expect(event!.properties.$page_id).toBe('')
    expect(event!.properties.$source_page_id).toBe('')
  })

  test('普通事件携带当前 $page_id/$source_page_id（与最近 page_view 一致）', () => {
    const collector = createCollector()
    const pageView = collector.collectEvent('page_view')
    const click = collector.collectEvent('click', { element_id: 'btn' })

    expect(click!.properties.$page_id).toBe(pageView!.properties.$page_id)
    expect(click!.properties.$source_page_id).toBe(pageView!.properties.$source_page_id)
  })

  test('第二个 page_view 轮换 id，后续事件跟随新值', () => {
    const collector = createCollector()
    const first = collector.collectEvent('page_view')
    const second = collector.collectEvent('page_view')

    expect(second!.properties.$page_id).toMatch(UUID_PATTERN)
    expect(second!.properties.$page_id).not.toBe(first!.properties.$page_id)
    expect(second!.properties.$source_page_id).toBe(first!.properties.$page_id)

    const click = collector.collectEvent('click')
    expect(click!.properties.$page_id).toBe(second!.properties.$page_id)
    expect(click!.properties.$source_page_id).toBe(second!.properties.$source_page_id)
  })

  test('业务显式传入 $page_id/$source_page_id 时不覆盖', () => {
    const collector = createCollector()
    const event = collector.collectEvent('page_view', {
      $page_id: 'biz-page-id',
      $source_page_id: 'biz-source-id',
    })

    expect(event!.properties.$page_id).toBe('biz-page-id')
    expect(event!.properties.$source_page_id).toBe('biz-source-id')
  })

  test('业务覆盖 $page_id 时内部轮换仍发生，后续事件使用轮换后的 id', () => {
    const collector = createCollector()
    collector.collectEvent('page_view', { $page_id: 'biz-page-id' })
    const click = collector.collectEvent('click')

    expect(click!.properties.$page_id).toMatch(UUID_PATTERN)
    expect(click!.properties.$page_id).not.toBe('biz-page-id')
  })
})

describe('归因事件标记', () => {
  test('page_view 携带 $spm 时标记为归因事件', () => {
    const collector = createCollector()
    const event = collector.collectEvent('page_view', { $spm: 'A.B' })

    expect(event!.properties.$is_attribution_event).toBe(true)
    expect(event!.properties.$target_page_id).toBe(event!.properties.$page_id)
  })

  test('page_view 仅携带 $scm 时也标记为归因事件', () => {
    const collector = createCollector()
    const event = collector.collectEvent('page_view', { $scm: 'a.b.c.d' })

    expect(event!.properties.$is_attribution_event).toBe(true)
    expect(event!.properties.$target_page_id).toBe(event!.properties.$page_id)
  })

  test('page_view 不带 $spm/$scm 时不输出归因字段', () => {
    const collector = createCollector()
    const event = collector.collectEvent('page_view')

    expect(event!.properties).not.toHaveProperty('$is_attribution_event')
    expect(event!.properties).not.toHaveProperty('$target_page_id')
  })

  test('page_view 的 $spm/$scm 为空串或纯空白时不标记', () => {
    const collector = createCollector()
    const event = collector.collectEvent('page_view', { $spm: '', $scm: '   ' })

    expect(event!.properties).not.toHaveProperty('$is_attribution_event')
    expect(event!.properties).not.toHaveProperty('$target_page_id')
  })

  test('非 page_view 事件即使携带 $spm/$scm 也不标记为归因事件', () => {
    const collector = createCollector()
    collector.collectEvent('page_view', { $spm: 'A.B' })
    const click = collector.collectEvent('click', { $spm: 'A.B.C.D', $scm: 'a.b.c.d' })

    expect(click!.properties).not.toHaveProperty('$is_attribution_event')
    expect(click!.properties).not.toHaveProperty('$target_page_id')
  })

  test('全局属性里的 $spm 同样触发归因标记', () => {
    const collector = createCollector({ globalProperties: { $spm: 'A.B' } })
    const event = collector.collectEvent('page_view')

    expect(event!.properties.$is_attribution_event).toBe(true)
    expect(event!.properties.$target_page_id).toBe(event!.properties.$page_id)
  })

  test('业务显式传入 $is_attribution_event/$target_page_id 时不覆盖', () => {
    const collector = createCollector()
    const event = collector.collectEvent('page_view', {
      $spm: 'A.B',
      $is_attribution_event: false,
      $target_page_id: 'biz-target',
    })

    expect(event!.properties.$is_attribution_event).toBe(false)
    expect(event!.properties.$target_page_id).toBe('biz-target')
  })
})

describe('$ex_attribution_params 序列化', () => {
  test('对象在采集时被序列化为 JSON 字符串', () => {
    const collector = createCollector()
    const params = { campaign: 'double11', channel: 'banner' }
    const event = collector.collectEvent('page_view', { $ex_attribution_params: params })

    expect(event!.properties.$ex_attribution_params).toBe(JSON.stringify(params))
  })

  test('已是字符串的原样透传', () => {
    const collector = createCollector()
    const str = '{"campaign":"double11"}'
    const event = collector.collectEvent('click', { $ex_attribution_params: str })

    expect(event!.properties.$ex_attribution_params).toBe(str)
  })

  test('空值（null/undefined/空串/空对象/空数组）不上报该字段', () => {
    const cases: any[] = [null, undefined, '', {}, []]
    for (const value of cases) {
      const collector = createCollector()
      const event = collector.collectEvent('click', { $ex_attribution_params: value })
      expect(event!.properties).not.toHaveProperty('$ex_attribution_params')
    }
  })

  test('无法序列化的循环引用不上报该字段', () => {
    const collector = createCollector()
    const circular: any = { a: 1 }
    circular.self = circular
    const event = collector.collectEvent('click', { $ex_attribution_params: circular })

    expect(event!.properties).not.toHaveProperty('$ex_attribution_params')
  })

  test('number/boolean 等非对象原始类型不上报该字段', () => {
    const collector = createCollector()
    const event = collector.collectEvent('click', { $ex_attribution_params: 42 })

    expect(event!.properties).not.toHaveProperty('$ex_attribution_params')
  })
})

describe('新字段与 maskSensitiveData 兼容', () => {
  test('默认开启脱敏时新字段不被误伤，敏感字段仍被脱敏', () => {
    const collector = createCollector()
    const event = collector.collectEvent('page_view', {
      $spm: 'A.B',
      $ex_attribution_params: { campaign: 'double11' },
      password: 'should-be-masked',
    })

    expect(event!.properties.password).toBe('***')
    expect(event!.properties.$page_id).toMatch(UUID_PATTERN)
    expect(event!.properties.$source_page_id).toBe('')
    expect(event!.properties.$is_attribution_event).toBe(true)
    expect(event!.properties.$ex_attribution_params).toBe('{"campaign":"double11"}')
  })
})

describe('DataSender prepareEvent 透传归因字段', () => {
  let senders: DataSender[] = []

  afterEach(() => {
    senders.forEach(sender => sender.destroy())
    senders = []
  })

  test('prepareEvent 的 data 完整携带 $page_id/$is_attribution_event/$ex_attribution_params', () => {
    const collector = createCollector()
    const config = new ConfigManager({
      apiUrl: 'http://localhost:3000/point/report',
      appId: 'test-app',
    })
    const sender = new DataSender(config)
    senders.push(sender)

    const event = collector.collectEvent('page_view', {
      $spm: 'A.B',
      $ex_attribution_params: { campaign: 'double11' },
    })!

    const prepared = (sender as any).prepareEvent(event)

    expect(prepared.data.$page_id).toBe(event.properties.$page_id)
    expect(prepared.data.$source_page_id).toBe('')
    expect(prepared.data.$spm).toBe('A.B')
    expect(prepared.data.$is_attribution_event).toBe(true)
    expect(prepared.data.$target_page_id).toBe(event.properties.$page_id)
    expect(prepared.data.$ex_attribution_params).toBe('{"campaign":"double11"}')
  })
})
