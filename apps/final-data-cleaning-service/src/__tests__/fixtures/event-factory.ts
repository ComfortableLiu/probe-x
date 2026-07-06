/**
 * 测试数据工厂
 * 
 * 生成各种场景的 IPreEventLog 模拟数据，
 * 覆盖单页面、多页面导航、归因事件、非归因事件等场景。
 */

import { IPreEventLog } from '@probe-x/shared-types/src'

let eventCounter = 0

/**
 * 重置事件计数器（每个测试用例前调用）
 */
export function resetEventCounter() {
  eventCounter = 0
}

/**
 * 生成一个基础事件，所有字段都有合理的默认值
 */
export function createBaseEvent(overrides: Record<string, any> = {}): IPreEventLog {
  eventCounter++
  // 使用毫秒偏移而非秒格式化，支持超过 59 个事件
  const now = new Date(new Date('2026-06-01T10:00:00Z').getTime() + eventCounter * 1000)

  return {
    $event_name: 'page_view',
    $log_time: now,
    $service_time: now,
    $ip: '192.168.1.100',
    $web_site: 'ecommerce-demo.probe-x.com',
    $web_pathname: '/home',
    $web_params: '',
    $device_id: 'device-001',
    $uid: 1001,
    $utm_source: 'google',
    $utm_campaign: 'summer_sale',
    $utm_medium: 'cpc',
    $utm_content: 'banner_top',
    $utm_term: 'electronics',
    $referrer: 'https://google.com/search',
    $zoon: 8,
    $device: 'desktop',
    $language: 'zh-CN',
    $ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    $screen_width: 1920,
    $screen_height: 1080,
    $viewport_width: 1440,
    $viewport_height: 900,
    $device_pixel_ratio: 2,
    $scroll_height: 2000,
    $element_id: '',
    $page_id: 'page-home',
    $source_page_id: '',
    $spm: 'a001.b001.c001.d001',
    $scm: 'a001.b001.c001.d001',
    $spm_a: 'a001',
    $spm_b: 'b001',
    $spm_c: 'c001',
    $spm_d: 'd001',
    $spm_a_description: '首页',
    $spm_b_description: '导航栏',
    $spm_c_description: 'Banner',
    $spm_d_description: '点击',
    $scm_a: 'a001',
    $scm_b: 'b001',
    $scm_c: 'c001',
    $scm_d: 'd001',
    $scm_a_description: 'Google',
    $scm_b_description: 'CPC',
    $scm_c_description: 'SummerSale',
    $scm_d_description: 'Electronics',
    $session_id: 'session-001',
    ...overrides,
  } as any as IPreEventLog
}

/**
 * 创建一个页面浏览事件（非归因事件）
 */
export function createPageViewEvent(
  pageId: string,
  sourcePageId: string = '',
  overrides: Record<string, any> = {},
): IPreEventLog {
  return createBaseEvent({
    $event_name: 'page_view',
    $page_id: pageId,
    $source_page_id: sourcePageId,
    ...overrides,
  })
}

/**
 * 创建一个点击事件（非归因事件）
 */
export function createClickEvent(
  pageId: string,
  elementId: string,
  overrides: Record<string, any> = {},
): IPreEventLog {
  return createBaseEvent({
    $event_name: 'click',
    $page_id: pageId,
    $element_id: elementId,
    ...overrides,
  })
}

/**
 * 创建一个归因事件（路由跳转，会触发归因计算）
 * 
 * @param sourcePageId 源页面 ID（$page_id，当前所在页面）
 * @param targetPageId 目标页面 ID（$target_page_id，即将跳转的页面）
 * @param spmOverrides SPM 参数覆盖
 * @param scmOverrides SCM 参数覆盖
 * @param exAttributionParams 扩展归因参数（注意：$session_id 如果在此处传，会被提升到顶层）
 */
export function createAttributionEvent(
  sourcePageId: string,
  targetPageId: string,
  spmOverrides: Record<string, any> = {},
  scmOverrides: Record<string, any> = {},
  exAttributionParams?: Record<string, any>,
): IPreEventLog {
  // 从 exAttributionParams 中提取顶层字段
  let topLevelSessionId: string | undefined
  let cleanExParams: Record<string, any> | undefined

  if (exAttributionParams) {
    const { $session_id, ...rest } = exAttributionParams
    topLevelSessionId = $session_id
    cleanExParams = Object.keys(rest).length > 0 ? rest : undefined
  }

  return createBaseEvent({
    $event_name: 'route_change',
    $spm: 'a001.b002.c002.d002',
    $scm: 'a001.b002.c002.d002',
    ...spmOverrides,
    ...scmOverrides,
    ...(cleanExParams ? { $ex_attribution_params: cleanExParams } : {}),
    // 关键字段放在最后，防止被 spread 覆盖
    $page_id: sourcePageId,
    $source_page_id: sourcePageId,
    $target_page_id: targetPageId,
    $is_attribution_event: true,
    // session_id 提升为顶层
    ...(topLevelSessionId ? { $session_id: topLevelSessionId } : {}),
  } as any)
}

/**
 * 场景：用户从首页进入商品列表页
 */
export function createHomepageToListScenario(sessionId: string = 'session-001'): IPreEventLog[] {
  resetEventCounter()
  return [
    createPageViewEvent('page-home', '', { $session_id: sessionId }),
    createClickEvent('page-home', 'nav-products-link', { $session_id: sessionId }),
    createAttributionEvent('page-home', 'page-product-list', {
      $spm_a: 'a001', $spm_b: 'b002', $spm_c: 'c002', $spm_d: 'd002',
      $spm_a_description: '首页', $spm_b_description: '导航', $spm_c_description: '商品列表', $spm_d_description: '入口',
    }, {
      $scm_a: 'a001', $scm_b: 'b002', $scm_c: 'c002', $scm_d: 'd002',
      $scm_a_description: 'Google', $scm_b_description: 'CPC', $scm_c_description: 'SummerSale', $scm_d_description: 'Nav',
    }, { $session_id: sessionId }),
    createPageViewEvent('page-product-list', 'page-home', { $session_id: sessionId }),
    createClickEvent('page-product-list', 'product-card-1', { $session_id: sessionId }),
  ]
}

/**
 * 场景：用户从首页 → 商品列表 → 商品详情（多级归因传递）
 * 
 * 注意归因算法的累积行为：
 * - 第 1 个归因事件（home → list）：page-product-list 获得 1 条归因项
 * - 第 2 个归因事件（list → detail）：因为 page-product-list 已在 Map 中，
 *   取出其累积数据（1条）+ 新推入 1 条 = page-product-list 有 2 条归因项，
 *   然后以 page-product-detail 为 key 存入（包含这 2 条）
 *   
 * 这是算法设计的预期行为（累积归因传递）。
 */
export function createMultiPageNavigationScenario(sessionId: string = 'session-001'): IPreEventLog[] {
  resetEventCounter()
  return [
    // 首页
    createPageViewEvent('page-home', '', { $session_id: sessionId }),
    createClickEvent('page-home', 'nav-products-link', { $session_id: sessionId }),
    // 归因：首页 → 商品列表
    createAttributionEvent('page-home', 'page-product-list', {
      $spm_a: 'a001', $spm_b: 'b002', $spm_c: 'c002', $spm_d: 'd002',
      $spm_a_description: '首页', $spm_b_description: '导航', $spm_c_description: '商品列表', $spm_d_description: '入口',
    }, {}, { $session_id: sessionId }),
    createPageViewEvent('page-product-list', 'page-home', { $session_id: sessionId }),
    // 归因：商品列表 → 商品详情
    createAttributionEvent('page-product-list', 'page-product-detail', {
      $spm_a: 'a001', $spm_b: 'b003', $spm_c: 'c003', $spm_d: 'd003',
      $spm_a_description: '商品列表', $spm_b_description: '商品卡片', $spm_c_description: 'iPhone', $spm_d_description: '点击',
    }, {}, {
      $product_id: 'prod-001',
      $product_name: 'iPhone 15 Pro',
      $session_id: sessionId,
    }),
    createPageViewEvent('page-product-detail', 'page-product-list', { $session_id: sessionId }),
    createClickEvent('page-product-detail', 'add-to-cart-btn', { $session_id: sessionId }),
  ]
}

/**
 * 场景：用户回退到首页再导航到其他页面（测试归因参数更新）
 * 
 * 路径：home → list → 回退 home → detail
 * 注意：home 从未作为 target_page_id 被 set 到 Map 中，
 * 所以第二次导航时 attributionDataMap.get('page-home') 返回 []
 */
export function createBackAndForthScenario(sessionId: string = 'session-001'): IPreEventLog[] {
  resetEventCounter()
  return [
    // 首页
    createPageViewEvent('page-home', '', { $session_id: sessionId }),
    // 归因：首页 → 商品列表
    createAttributionEvent('page-home', 'page-product-list', {
      $spm_a: 'a001', $spm_b: 'b002', $spm_c: 'c002', $spm_d: 'd002',
      $spm_a_description: '首页', $spm_b_description: '导航', $spm_c_description: '商品列表', $spm_d_description: '入口',
    }, {}, { $session_id: sessionId }),
    createPageViewEvent('page-product-list', 'page-home', { $session_id: sessionId }),
    // 归因：首页 → 商品详情（回退后重新导航）
    createAttributionEvent('page-home', 'page-product-detail', {
      $spm_a: 'a001', $spm_b: 'b004', $spm_c: 'c004', $spm_d: 'd004',
      $spm_a_description: '首页', $spm_b_description: '推荐位', $spm_c_description: '商品详情', $spm_d_description: '直达',
    }, {}, { $session_id: sessionId }),
    createPageViewEvent('page-product-detail', 'page-home', { $session_id: sessionId }),
  ]
}

/**
 * 场景：无任何归因事件的纯浏览行为
 */
export function createNoAttributionScenario(sessionId: string = 'session-001'): IPreEventLog[] {
  resetEventCounter()
  return [
    createPageViewEvent('page-home', '', { $session_id: sessionId }),
    createClickEvent('page-home', 'some-button', { $session_id: sessionId }),
    createClickEvent('page-home', 'another-button', { $session_id: sessionId }),
  ]
}

/**
 * 场景：包含扩展归因参数的事件（如自定义 campaign_id、ad_group 等）
 */
export function createExAttributionScenario(sessionId: string = 'session-001'): IPreEventLog[] {
  resetEventCounter()
  return [
    createPageViewEvent('page-home', '', { $session_id: sessionId }),
    createAttributionEvent('page-home', 'page-landing', {}, {}, {
      $campaign_id: 'camp-2026-summer',
      $ad_group: 'ad-group-mobile',
      $creative_id: 'creative-video-01',
      $landing_source: 'douyin',
      $session_id: sessionId,
    }),
    createPageViewEvent('page-landing', 'page-home', { $session_id: sessionId }),
  ]
}

/**
 * 场景：多 Session 数据（用于测试按 session 过滤）
 */
export function createMultiSessionScenario(): IPreEventLog[] {
  resetEventCounter()
  return [
    // Session A: 首页 → 列表
    createPageViewEvent('page-home', '', { $session_id: 'session-A' }),
    createAttributionEvent('page-home', 'page-product-list', {
      $spm_a: 'a001', $spm_b: 'b002', $spm_c: 'c002', $spm_d: 'd002',
      $spm_a_description: '首页-A', $spm_b_description: '导航-A', $spm_c_description: '列表-A', $spm_d_description: '入口-A',
    }, {}, { $session_id: 'session-A' }),
    // Session B: 首页 → 详情
    createPageViewEvent('page-home', '', { $session_id: 'session-B' }),
    createAttributionEvent('page-home', 'page-product-detail', {
      $spm_a: 'a002', $spm_b: 'b003', $spm_c: 'c003', $spm_d: 'd003',
      $spm_a_description: '首页-B', $spm_b_description: '推荐-B', $spm_c_description: '详情-B', $spm_d_description: '直达-B',
    }, {}, { $session_id: 'session-B' }),
  ]
}

/**
 * 场景：大量事件（用于进度上报和多节点负载测试）
 */
export function createHighVolumeScenario(
  sessionId: string = 'session-hv',
  eventCount: number = 100,
): IPreEventLog[] {
  resetEventCounter()
  const events: IPreEventLog[] = []

  for (let i = 0; i < eventCount; i++) {
    const pageId = `page-${i % 5}`
    const nextPageId = `page-${(i + 1) % 5}`

    events.push(createPageViewEvent(pageId, i > 0 ? `page-${(i - 1) % 5}` : '', {
      $session_id: sessionId,
    }))

    // 每 3 个事件插入一个归因事件
    if (i % 3 === 0 && i < eventCount - 1) {
      events.push(createAttributionEvent(pageId, nextPageId, {
        $spm_c: `c-${i}`,
        $spm_c_description: `归因位置-${i}`,
      }, {}, {
        $event_index: i,
        $session_id: sessionId,
      }))
    }
  }

  return events
}
