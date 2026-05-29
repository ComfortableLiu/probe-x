#!/usr/bin/env node
/**
 * Probe-X 测试数据生成脚本（v2 - 符合真实业务逻辑）
 *
 * 核心改进:
 *   - 用户分层: 活跃用户(多天多会话)/普通用户(偶尔来)/一次性用户
 *   - 同一用户所有会话共用 device_id / UA / 设备参数
 *   - 同一会话内 ip 不变, session_id 不变
 *   - 真实行为链路: page_view → (停留) → 交互事件 → page_view → ...
 *   - source_page_id 指向前一个 *页面* 的 page_id（而非前一条事件）
 *   - page_stay 事件携带真实 duration
 *   - URL 参数只在会话首个 page_view 上带, UTM 字段继承到整个 session
 *   - 漏斗路径有转化率分布, 不是均匀随机
 *
 * 用法:
 *   node scripts/generate-test-data.js [选项]
 *   --days=7 --events=50000 --users=500 --sessions=3000 --batch=5000
 *   --dirty-rate=0.03 --host=http://localhost:8123 --database=probe_x
 *   --username=admin --password=your_password --dry-run --clean
 */

const http = require('http')
const https = require('https')
const { URL } = require('url')

// ==================== 配置 ====================
function parseArgs() {
  const args = {
    days: 7, events: 50000, users: 500, sessions: 3000, batch: 5000, preview: 10,
    host: 'http://123.56.201.124:9301',
    database: process.env.CLICKHOUSE_DATABASE || 'probe_x',
    username: 'admin',
    password: '12341234',
    dryRun: false, clean: false, dirtyRate: 0.03,
  }
  for (const raw of process.argv.slice(2)) {
    const m = raw.match(/^--(.+?)(?:=(.+))?$/)
    if (!m) continue
    const [, k, v] = m
    const key = normalizeArgKey(k)
    if (v === undefined) { args[key] = true; continue }
    args[key] = parseArgValue(v, key)
  }
  return args
}

function normalizeArgKey(key) {
  const normalized = key.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
  const aliases = {
    dry_run: 'dryRun',
    dirty_rate: 'dirtyRate',
    user: 'username',
  }
  return aliases[normalized] || normalized
}

function parseArgValue(value, key) {
  if (['host','database','username','password'].includes(key)) return value
  if (value === 'true') return true
  if (value === 'false') return false
  return value !== '' && !isNaN(Number(value)) ? Number(value) : value
}

function safeArgsForLog(args) {
  return {
    ...args,
    password: args.password ? '***' : '',
  }
}

// ==================== 工具 ====================
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min
const uuid = () => [8,4,4,4,12].map(n => Array.from({length:n}, () => ((Math.random()*16)|0).toString(16)).join('')).join('-')
const weightedPick = (items, weights) => {
  const total = weights.reduce((a,b)=>a+b, 0)
  let r = Math.random() * total
  for (let i = 0; i < items.length; i++) { r -= weights[i]; if (r <= 0) return items[i] }
  return items[items.length - 1]
}

// ==================== 常量 ====================
const PAGES = [
  { path: '/',                spm: 'home',            isEntry: true },
  { path: '/search',          spm: 'search',          isEntry: false },
  { path: '/product/list',    spm: 'product_list',    isEntry: false },
  { path: '/product/detail',  spm: 'product_detail',  isEntry: false },
  { path: '/cart',            spm: 'cart',            isEntry: false },
  { path: '/order/create',    spm: 'order_create',    isEntry: false },
  { path: '/order/pay',       spm: 'order_pay',       isEntry: false },
  { path: '/order/result',    spm: 'order_result',    isEntry: false },
  { path: '/user/profile',    spm: 'user_profile',    isEntry: true },
  { path: '/user/orders',     spm: 'user_orders',     isEntry: false },
  { path: '/category',        spm: 'category',        isEntry: true },
  { path: '/activity/sale',   spm: 'activity_sale',   isEntry: true },
]

// 漏斗转化率（从首页到支付结果的真实电商转化率）
const FUNNEL_RATES = [
  { page: '/',                reachRate: 1.0,   actionRate: 0.6  },  // 60% 点击搜索/分类
  { page: '/search',          reachRate: 0.55,  actionRate: 0.5  },  // 50% 点击商品
  { page: '/product/detail',  reachRate: 0.30,  actionRate: 0.12 },  // 12% 加购
  { page: '/cart',            reachRate: 0.10,  actionRate: 0.7  },  // 70% 下单
  { page: '/order/create',    reachRate: 0.07,  actionRate: 0.85 },  // 85% 提交订单
  { page: '/order/pay',       reachRate: 0.06,  actionRate: 0.90 },  // 90% 支付成功
  { page: '/order/result',    reachRate: 0.054, actionRate: 0    },
]

const UTM_SOURCES  = ['baidu','google','wechat','douyin','xiaohongshu','zhihu','direct','','','']
const UTM_MEDIUMS  = ['cpc','organic','social','referral','email','display','','','','']
const UTM_CAMPAIGNS = ['spring_sale_2026','summer_promo','new_user_discount','vip_day','','','','','']
const UTM_TERMS    = ['手机','电脑','优惠券','数码产品','','','','','']
const UTM_CONTENTS = ['banner_top','sidebar_ad','popup_modal','','','','','']

const SPM_SEGMENTS = {
  a: ['home','product','user','activity','system'],
  b: ['list','detail','cart','order','profile','search','guide'],
  c: ['item','btn','img','form','tab','card','modal','nav'],
  d: ['buy','submit','click','view','share','filter','sort','add'],
}
const SCM_SEGMENTS = {
  a: ['channel_web','channel_app','channel_mini'],
  b: ['site_main','site_activity','site_mobile'],
  c: ['page_home','page_product','page_order'],
  d: ['module_header','module_content','module_sidebar'],
}

const BROWSERS = [
  { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0', device: 'desktop', sw: 1920, sh: 1080, dpr: 1 },
  { ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 Safari/17.0', device: 'desktop', sw: 2560, sh: 1440, dpr: 2 },
  { ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile', device: 'mobile', sw: 390, sh: 844, dpr: 3 },
  { ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/131.0 Mobile', device: 'mobile', sw: 412, sh: 915, dpr: 2.6 },
  { ua: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15', device: 'tablet', sw: 820, sh: 1180, dpr: 2 },
]
const SITES = ['www.probe-x.com','m.probe-x.com','shop.probe-x.com']

// ==================== 用户生成（分层） ====================
function generateUsers(count) {
  // 20% 活跃用户(1天3-8会话), 50% 普通用户(1天1-2会话), 30% 一次性用户(总共1会话)
  const users = []
  for (let i = 0; i < count; i++) {
    const tier = weightedPick(['active','normal','oneoff'], [20, 50, 30])
    const browser = pick(BROWSERS)
    const site = browser.device === 'mobile' ? pick(['m.probe-x.com','www.probe-x.com']) : pick(SITES)
    const hasUtm = Math.random() < 0.35
    const utm = hasUtm ? {
      source:  pick(UTM_SOURCES.filter(Boolean)),
      medium:  pick(UTM_MEDIUMS.filter(Boolean)),
      campaign: pick(UTM_CAMPAIGNS.filter(Boolean)),
      term:    pick(UTM_TERMS.filter(Boolean)),
      content: pick(UTM_CONTENTS.filter(Boolean)),
    } : null

    users.push({
      uid: i + 1,
      deviceId: uuid(),
      browser,
      language: browser.ua.includes('iPhone') ? 'zh-CN' : pick(['zh-CN','zh-TW','en-US','en']),
      site,
      tier,
      utm,
      sessionsPerDay: tier === 'active' ? randInt(1,2) : tier === 'normal' ? 1 : 1,
      totalSessions:  tier === 'oneoff' ? 1 : undefined,
      activeDays:     tier === 'active' ? randInt(3,5) : tier === 'normal' ? randInt(1,3) : 1,
    })
  }
  return users
}

// ==================== 单会话生成（真实行为链路） ====================
function generateSession(user, startTime, utmOverride) {
  const sessionId = uuid()
  const ip = `${randInt(1,223)}.${randInt(0,255)}.${randInt(0,255)}.${randInt(1,254)}`
  const sessionUtm = utmOverride || user.utm

  // 决定本次会话的路径类型
  const pathType = weightedPick(
    ['full_funnel','partial_funnel','browse','single_page','revisit'],
    [5, 20, 35, 20, 20],
  )

  const events = []
  let eventTime = startTime
  let prevPageId = ''  // 前一个 *页面* 的 page_id
  let prevPagePath = ''
  let currentPageId = uuid()
  let pageStayStart = startTime

  // 根据路径类型生成页面序列
  let pageIndices = []
  switch (pathType) {
    case 'full_funnel': {
      // 按漏斗转化率逐级推进, 每级可能掉出
      const funnelPages = [0,1,3,4,5,6,7] // home→search→detail→cart→order_create→pay→result
      pageIndices = [funnelPages[0]] // 总是以首页开始
      for (let fi = 1; fi < funnelPages.length; fi++) {
        const rate = FUNNEL_RATES[fi].reachRate / FUNNEL_RATES[fi-1].reachRate
        if (Math.random() < rate) pageIndices.push(funnelPages[fi])
        else break
      }
      break
    }
    case 'partial_funnel': {
      // 走几步就跳出
      const depth = randInt(1, 3)
      pageIndices = [0] // 首页
      if (Math.random() < 0.5) pageIndices.push(1) // 搜索
      if (depth > 1 && Math.random() < 0.4) pageIndices.push(3) // 详情
      if (depth > 2 && Math.random() < 0.15) pageIndices.push(4) // 购物车
      break
    }
    case 'browse': {
      // 无目的浏览, 3-7 页
      const len = randInt(3, 7)
      const entryPages = PAGES.filter(p => p.isEntry).map((p,i) => PAGES.indexOf(p))
      pageIndices = [pick(entryPages)] // 从某个入口开始
      for (let j = 1; j < len; j++) {
        // 浏览用户随机跳转
        const prev = pageIndices[j-1]
        const nextOptions = getNextPages(prev)
        pageIndices.push(pick(nextOptions))
      }
      break
    }
    case 'single_page': {
      const entryPages = PAGES.filter(p => p.isEntry).map((p,i) => PAGES.indexOf(p))
      pageIndices = [pick(entryPages)]
      break
    }
    case 'revisit': {
      // 回访用户: 查订单、看个人中心
      pageIndices = [0, 9] // 首页→我的订单
      break
    }
  }

  // 每个页面生成: page_view → (page_stay) → 交互事件 → ... → 下一个 page_view
  for (let pi = 0; pi < pageIndices.length; pi++) {
    const pageIdx = pageIndices[pi]
    const page = PAGES[pageIdx]

    // ---- page_view 事件 ----
    prevPageId = currentPageId
    currentPageId = uuid()
    pageStayStart = eventTime

    const pvEvent = makeEvent({
      eventName: 'page_view',
      user, sessionId, ip,
      page, pageId: currentPageId, sourcePageId: pi > 0 ? prevPageId : '',
      referrer: pi > 0 ? prevPagePath : '',
      eventTime,
      utm: sessionUtm,
      includeWebParams: pi === 0 && !!sessionUtm,
      spm: { a: pick(SPM_SEGMENTS.a), b: page.spm, c: '', d: '' },
      scm: { a: pick(SCM_SEGMENTS.a), b: pick(SCM_SEGMENTS.b), c: '', d: '' },
    })
    events.push(pvEvent)
    eventTime += randInt(500, 3000) // 服务端处理延迟后用户开始看页面

    // ---- 页面上的交互事件（1-5个） ----
    const interactCount = randInt(1, 5)
    for (let ic = 0; ic < interactCount; ic++) {
      eventTime += randInt(2000, 15000) // 用户交互间隔 2-15 秒
      if (eventTime - startTime > 1800000) break // 会话不超过30分钟

      const action = pickActionForPage(pageIdx)
      const nextPageIdx = pageIndices[pi + 1]
      const isNavigationAction = nextPageIdx !== undefined && ic === interactCount - 1
      const isAttribution = isNavigationAction || action === 'add_to_cart' || action === 'form_submit'
      const targetPageId = isNavigationAction ? '__NEXT_PAGE__' : currentPageId

      const spmC = action === 'click' || action === 'element_click' ? pick(SPM_SEGMENTS.c) : ''
      const spmD = action === 'click' || action === 'element_click' ? pick(SPM_SEGMENTS.d) : ''

      const actEvent = makeEvent({
        eventName: action,
        user, sessionId, ip,
        page, pageId: currentPageId, sourcePageId: currentPageId, // 交互事件 source = 当前页面
        referrer: prevPagePath,
        eventTime,
        utm: sessionUtm,
        spm: { a: pick(SPM_SEGMENTS.a), b: page.spm, c: spmC, d: spmD },
        scm: { a: pick(SCM_SEGMENTS.a), b: pick(SCM_SEGMENTS.b), c: pick(SCM_SEGMENTS.c), d: pick(SCM_SEGMENTS.d) },
        scrollHeight: action === 'scroll' ? randInt(200, Math.max(300, user.browser.sh * 3)) : randInt(0, 200),
        elementId: action === 'click' || action === 'element_click'
          ? `#${pick(['btn-buy','btn-add-cart','btn-search','btn-submit','nav-link','tab-item','modal-close','link-detail'])}`
          : '',
        isAttribution,
        targetPageId: isAttribution ? targetPageId : '',
      })
      events.push(actEvent)
    }

    // ---- page_stay 事件（离开页面时） ----
    const stayDuration = eventTime - pageStayStart
    if (stayDuration > 5000 && pi < pageIndices.length - 1) {
      eventTime += randInt(500, 2000)
      const stayEvent = makeEvent({
        eventName: 'page_stay',
        user, sessionId, ip,
        page, pageId: currentPageId, sourcePageId: currentPageId,
        referrer: prevPagePath,
        eventTime,
        utm: sessionUtm,
        spm: { a: pick(SPM_SEGMENTS.a), b: page.spm, c: '', d: '' },
        scm: { a: pick(SCM_SEGMENTS.a), b: pick(SCM_SEGMENTS.b), c: '', d: '' },
        duration: Math.round(stayDuration / 1000),
      })
      events.push(stayEvent)
      eventTime += randInt(100, 800)
    }

    prevPagePath = page.path
  }

  linkTargetPageIds(events)
  return events
}

function linkTargetPageIds(events) {
  for (let i = 0; i < events.length; i++) {
    if (events[i]['$target_page_id'] !== '__NEXT_PAGE__') continue
    const nextPageView = events.slice(i + 1).find(e => e['$event_name'] === 'page_view')
    events[i]['$target_page_id'] = nextPageView ? nextPageView['$page_id'] : events[i]['$page_id']
  }
}

function injectDirtyData(events, dirtyRate) {
  if (!dirtyRate) return
  const safeRate = Math.min(Math.max(Number(dirtyRate) || 0, 0), 0.049)
  const dirtyCount = Math.floor(events.length * safeRate)
  const indices = new Set()
  while (indices.size < dirtyCount && indices.size < events.length) indices.add(randInt(0, events.length - 1))

  for (const index of indices) {
    const event = events[index]
    const dirtyType = weightedPick(
      ['missing_uid','missing_utm','bad_spm','clock_skew','empty_element','odd_viewport'],
      [10, 25, 20, 15, 20, 10],
    )
    switch (dirtyType) {
      case 'missing_uid':
        event['$uid'] = 0
        break
      case 'missing_utm':
        event['$utm_source'] = ''
        event['$utm_medium'] = ''
        event['$utm_campaign'] = ''
        event['$utm_content'] = ''
        event['$utm_term'] = ''
        break
      case 'bad_spm':
        event['$spm'] = event['$spm'].split('.').slice(0, 2).join('.')
        event['$spm_c'] = ''
        event['$spm_d'] = ''
        break
      case 'clock_skew':
        event['$log_time'] = formatTime(new Date(Date.parse(event['$service_time'].replace(' ', 'T')) - randInt(5, 20) * 60000))
        break
      case 'empty_element':
        event['$element_id'] = ''
        break
      case 'odd_viewport':
        event['$viewport_width'] = Math.max(1, Math.floor(event['$screen_width'] * 0.2))
        event['$viewport_height'] = Math.max(1, Math.floor(event['$screen_height'] * 0.2))
        break
    }
    event.__dirty = dirtyType
  }
}

function selectEvents(allEvents, eventTarget, sessionTarget) {
  const groupsBySession = new Map()
  for (const event of allEvents) {
    const sessionId = event['$session_id']
    if (!groupsBySession.has(sessionId)) groupsBySession.set(sessionId, [])
    groupsBySession.get(sessionId).push(event)
  }

  const sessionGroups = Array.from(groupsBySession.values())
    .map(group => group.sort((a, b) => a['$service_time'].localeCompare(b['$service_time'])))
    .sort((a, b) => a[0]['$service_time'].localeCompare(b[0]['$service_time']))

  const userGroupsByUid = new Map()
  for (const group of sessionGroups) {
    const uid = group[0]['$uid']
    if (!userGroupsByUid.has(uid)) {
      userGroupsByUid.set(uid, { uid, sessions: [] })
    }
    userGroupsByUid.get(uid).sessions.push(group)
  }

  const userGroups = Array.from(userGroupsByUid.values())
    .map(userGroup => ({
      ...userGroup,
      sessions: userGroup.sessions.sort((a, b) => a[0]['$service_time'].localeCompare(b[0]['$service_time'])),
    }))
    .sort((a, b) => a.sessions[0][0]['$service_time'].localeCompare(b.sessions[0][0]['$service_time']))

  const desiredSessionCount = Math.min(sessionGroups.length, Math.max(1, Math.min(sessionTarget, eventTarget)))
  const desiredUserCount = Math.min(userGroups.length, Math.max(1, Math.round(desiredSessionCount * 0.7)))
  const selectedUsers = pickSpread(userGroups, desiredUserCount)
  const selectedSessionGroups = []
  const selectedSessionIds = new Set()

  const addSessionGroup = group => {
    if (!group) return false
    const sessionId = group[0]['$session_id']
    if (selectedSessionIds.has(sessionId)) return false
    selectedSessionIds.add(sessionId)
    selectedSessionGroups.push(group)
    return true
  }

  for (const userGroup of selectedUsers) {
    addSessionGroup(userGroup.sessions[0])
  }

  const userQueues = selectedUsers.map(userGroup => userGroup.sessions.slice(1)).filter(queue => queue.length > 0)
  const remainingUserQueues = userGroups
    .filter(userGroup => !selectedUsers.includes(userGroup))
    .map(userGroup => userGroup.sessions.slice())
    .filter(queue => queue.length > 0)

  let selectedCapacity = selectedSessionGroups.reduce((sum, group) => sum + group.length, 0)
  let remainingSessionsNeeded = desiredSessionCount - selectedSessionGroups.length

  while (remainingSessionsNeeded > 0 && (userQueues.length > 0 || remainingUserQueues.length > 0)) {
    const queues = userQueues.length > 0 ? userQueues : remainingUserQueues
    let progressed = false
    for (const queue of queues) {
      if (!queue.length || remainingSessionsNeeded <= 0) continue
      const group = queue.shift()
      if (addSessionGroup(group)) {
        selectedCapacity += group.length
        remainingSessionsNeeded--
        progressed = true
      }
    }
    if (!progressed) break
  }

  const fallbackQueues = sessionGroups
    .filter(group => !selectedSessionIds.has(group[0]['$session_id']))
    .map(group => [group])

  while (selectedCapacity < eventTarget && fallbackQueues.length > 0) {
    const nextRound = []
    let progressed = false
    for (const queue of fallbackQueues) {
      if (!queue.length) continue
      const group = queue.shift()
      if (addSessionGroup(group)) {
        selectedCapacity += group.length
        progressed = true
      }
      if (queue.length) nextRound.push(queue)
      if (selectedCapacity >= eventTarget) break
    }
    fallbackQueues.length = 0
    fallbackQueues.push(...nextRound)
    if (!progressed) break
  }

  const selected = roundRobinEvents(selectedSessionGroups, eventTarget)
  return selected.sort((a, b) => a['$service_time'].localeCompare(b['$service_time']))
}

function roundRobinEvents(selectedGroups, eventTarget) {
  const cursors = new Map(selectedGroups.map(group => [group[0]['$session_id'], 0]))
  const selected = []

  while (selected.length < eventTarget) {
    let progressed = false
    for (const group of selectedGroups) {
      const sessionId = group[0]['$session_id']
      const cursor = cursors.get(sessionId)
      if (cursor >= group.length) continue
      selected.push(group[cursor])
      cursors.set(sessionId, cursor + 1)
      progressed = true
      if (selected.length >= eventTarget) break
    }
    if (!progressed) break
  }

  return selected
}

function pickSpread(items, count) {
  if (count >= items.length) return items
  const selected = []
  const step = items.length / count
  for (let i = 0; i < count; i++) selected.push(items[Math.floor(i * step)])
  return selected
}

function normalizeDirtyRate(rate) {
  return Math.min(Math.max(Number(rate) || 0, 0), 0.049)
}

function buildSessionPlan(users, days, targetSessions) {
  const plan = []
  const maxSessions = Math.max(targetSessions, users.length)

  for (const user of users) {
    if (plan.length >= maxSessions) break
    plan.push({
      user,
      dayIdx: randInt(0, days - 1),
      sessionIndexForUser: 0,
      utm: user.utm,
    })
  }

  const userSessionCounts = new Map(users.map(user => [user.uid, plan.filter(item => item.user.uid === user.uid).length]))
  while (plan.length < targetSessions) {
    const user = weightedPick(users, users.map(item => item.tier === 'active' ? 6 : item.tier === 'normal' ? 3 : 1))
    const count = userSessionCounts.get(user.uid) || 0
    if (user.tier === 'oneoff' && count >= 1) continue
    const maxUserSessions = user.tier === 'active' ? days * 2 : user.tier === 'normal' ? Math.max(2, days) : 1
    if (count >= maxUserSessions) continue
    plan.push({
      user,
      dayIdx: randInt(0, days - 1),
      sessionIndexForUser: count,
      utm: makeSessionUtm(user, count),
    })
    userSessionCounts.set(user.uid, count + 1)
  }

  return plan.sort((a, b) => a.dayIdx - b.dayIdx)
}

function makeSessionUtm(user, sessionIndexForUser) {
  if (sessionIndexForUser === 0) return user.utm
  if (Math.random() >= 0.25) return user.utm
  return {
    source: pick(UTM_SOURCES.filter(Boolean)),
    medium: pick(UTM_MEDIUMS.filter(Boolean)),
    campaign: pick(UTM_CAMPAIGNS.filter(Boolean)),
    term: Math.random() < 0.5 ? pick(UTM_TERMS.filter(Boolean)) : '',
    content: Math.random() < 0.5 ? pick(UTM_CONTENTS.filter(Boolean)) : '',
  }
}

// 页面跳转的下一个可能页面
function getNextPages(currentIdx) {
  const transitions = {
    0:  [1,2,3,11,8,9],     // 首页 → 搜索/列表/详情/活动/个人中心/订单
    1:  [2,3,0],             // 搜索 → 列表/详情/首页
    2:  [3,0,1],             // 商品列表 → 详情/首页/搜索
    3:  [4,0,1],             // 商品详情 → 购物车/首页/搜索
    4:  [5,3,0],             // 购物车 → 下单/详情/首页
    5:  [6,4],               // 下单页 → 支付/购物车
    6:  [7,5],               // 支付页 → 结果/下单页
    7:  [8,0],               // 支付结果 → 个人中心/首页
    8:  [9,0,10],            // 个人中心 → 我的订单/首页/分类
    9:  [8,0],               // 我的订单 → 个人中心/首页
    10: [2,3,0],             // 分类 → 列表/详情/首页
    11: [2,3,0],             // 活动 → 列表/详情/首页
  }
  return transitions[currentIdx] || [0]
}

// 根据当前页面选择合理的交互事件
function pickActionForPage(pageIdx) {
  const pageActions = {
    0:  ['click','scroll','search'],                   // 首页
    1:  ['click','element_click','search'],            // 搜索页
    2:  ['click','scroll','element_click'],            // 商品列表
    3:  ['click','element_click','add_to_cart','scroll','share'], // 详情（可能加购）
    4:  ['click','element_click'],                     // 购物车
    5:  ['click','form_submit','element_click'],       // 下单页（提交表单）
    6:  ['click','form_submit'],                       // 支付页
    7:  ['click','share'],                             // 结果页（可能分享）
    8:  ['click','element_click'],                     // 个人中心
    9:  ['click','element_click'],                     // 我的订单
    10: ['click','scroll','element_click'],            // 分类
    11: ['click','scroll','element_click','coupon_use'], // 活动（可能领券）
  }
  return pick(pageActions[pageIdx] || ['click'])
}

const PRODUCT_CATEGORIES = ['phone','computer','camera','audio','home_appliance','beauty','sports']
const SEARCH_KEYWORDS = ['手机','电脑','耳机','相机','优惠券','运动鞋','护肤品','咖啡机']
const COUPON_IDS = ['coupon-new-user','coupon-vip-day','coupon-spring-sale','coupon-free-shipping']

// ==================== 构造单条事件 ====================
function makeEvent({ eventName, user, sessionId, ip, page, pageId, sourcePageId, referrer, eventTime, utm, includeWebParams, spm, scm, scrollHeight, elementId, isAttribution, targetPageId, duration }) {
  const logTime = new Date(eventTime)
  const serviceTime = new Date(eventTime + randInt(5, 200))

  return {
    '$event_name': eventName,
    '$log_time': formatTime(logTime),
    '$service_time': formatTime(serviceTime),
    '$ip': ip,
    '$web_site': user.site,
    '$web_pathname': page.path,
    '$web_params': includeWebParams && utm ? makeUtmParams(utm) : '',
    '$device_id': user.deviceId,
    '$uid': user.uid,
    '$utm_source':  utm?.source  || '',
    '$utm_medium':  utm?.medium  || '',
    '$utm_campaign': utm?.campaign || '',
    '$utm_content': utm?.content  || '',
    '$utm_term':    utm?.term    || '',
    '$referrer': referrer || '',
    '$zoon': -28800000,
    '$device': user.browser.device,
    '$language': user.language,
    '$ua': user.browser.ua,
    '$screen_width': user.browser.sw,
    '$screen_height': user.browser.sh,
    '$viewport_width': Math.floor(user.browser.sw * 0.92),
    '$viewport_height': Math.floor(user.browser.sh * 0.68),
    '$device_pixel_ratio': user.browser.dpr,
    '$scroll_height': scrollHeight || randInt(0, 200),
    '$element_id': elementId || '',
    '$page_id': pageId,
    '$source_page_id': sourcePageId || '',
    '$spm': [spm.a, spm.b, spm.c, spm.d].filter(Boolean).join('.') || '',
    '$scm': [scm.a, scm.b, scm.c, scm.d].filter(Boolean).join('.') || '',
    '$spm_a': spm.a,
    '$spm_b': spm.b,
    '$spm_c': spm.c,
    '$spm_d': spm.d,
    '$spm_a_description': `${spm.a}模块`,
    '$spm_b_description': `${spm.b}区块`,
    '$spm_c_description': spm.c ? `${spm.c}元素` : '',
    '$spm_d_description': spm.d ? `${spm.d}操作` : '',
    '$scm_a': scm.a,
    '$scm_b': scm.b,
    '$scm_c': scm.c,
    '$scm_d': scm.d,
    '$scm_a_description': `${scm.a}渠道`,
    '$scm_b_description': `${scm.b}站点`,
    '$scm_c_description': scm.c ? `${scm.c}页面` : '',
    '$scm_d_description': scm.d ? `${scm.d}区域` : '',
    '$session_id': sessionId,
    ...makeBusinessFields(eventName, page.path),
    ...(isAttribution ? { '$is_attribution_event': 1, '$target_page_id': targetPageId } : {}),
    ...(duration ? { duration } : {}),
  }
}

function makeUtmParams(utm) {
  return [
    ['utm_source', utm.source],
    ['utm_medium', utm.medium],
    ['utm_campaign', utm.campaign],
    ['utm_content', utm.content],
    ['utm_term', utm.term],
  ].filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')
}

function makeBusinessFields(eventName, pagePath) {
  const productId = `sku-${randInt(10000, 99999)}`
  const price = Number((randInt(990, 199900) / 100).toFixed(2))
  const fields = {
    product_id: '',
    product_category: '',
    order_id: '',
    order_amount: 0,
    search_keyword: '',
    coupon_id: '',
  }

  if (pagePath.includes('product') || ['add_to_cart','purchase'].includes(eventName)) {
    fields.product_id = productId
    fields.product_category = pick(PRODUCT_CATEGORIES)
  }
  if (eventName === 'search') fields.search_keyword = pick(SEARCH_KEYWORDS)
  if (eventName === 'coupon_use') fields.coupon_id = pick(COUPON_IDS)
  if (eventName === 'form_submit' && pagePath === '/order/pay') {
    fields.order_id = `ord-${randInt(100000, 999999)}`
    fields.order_amount = price
  }
  return fields
}

function formatTime(d) {
  // ClickHouse DateTime64(3) 格式: YYYY-MM-DD HH:MM:SS.SSS
  const pad = (n, w) => String(n).padStart(w, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1,2)}-${pad(d.getDate(),2)} ${pad(d.getHours(),2)}:${pad(d.getMinutes(),2)}:${pad(d.getSeconds(),2)}.${pad(d.getMilliseconds(),3)}`
}

// ==================== 归因数据 ====================
function generateAttributionData(events) {
  const rows = []
  for (const e of events) {
    if (e['$is_attribution_event'] !== 1) continue
    const attrs = [
      { key: 'utm_source',   value: e['$utm_source']  || 'direct' },
      { key: 'spm_channel',  value: e['$spm_a'] },
      { key: 'spm_page',     value: e['$spm_b'] },
      { key: 'spm_element',  value: e['$spm_c'] || '' },
      { key: 'scm_channel',  value: e['$scm_a'] },
      { key: 'referrer_path', value: e['$referrer'] || '/' },
    ]
    let idx = 0
    for (const a of attrs) {
      if (!a.value) continue
      rows.push({
        source_page_id: e['$source_page_id'],
        attribution_index: idx,
        attr_key: a.key,
        attr_value: a.value,
        event_time: e['$service_time'],
      })
      idx++
    }
  }
  return rows
}

// ==================== ClickHouse 字段兼容 ====================
const EVENT_TABLE_COLUMNS = [
  '$event_name','$log_time','$service_time','$ip','$web_site','$web_pathname','$web_params',
  '$device_id','$uid','$utm_source','$utm_campaign','$utm_medium','$utm_content','$utm_term',
  '$referrer','$zoon','$device','$language','$ua','$screen_width','$screen_height',
  '$viewport_width','$viewport_height','$device_pixel_ratio','$scroll_height','$element_id',
  '$page_id','$source_page_id','$spm','$scm','$spm_a','$spm_b','$spm_c','$spm_d',
  '$spm_a_description','$spm_b_description','$spm_c_description','$spm_d_description',
  '$scm_a','$scm_b','$scm_c','$scm_d','$scm_a_description','$scm_b_description',
  '$scm_c_description','$scm_d_description','$session_id',
]

const ATTRIBUTION_TABLE_COLUMNS = ['source_page_id','attribution_index','attr_key','attr_value','event_time']
const INTERNAL_COLUMNS = new Set(['__dirty'])

function defaultTableSchemas() {
  return {
    event_log: new Set(EVENT_TABLE_COLUMNS),
    final_event_log: new Set(EVENT_TABLE_COLUMNS),
    event_attribution: new Set(ATTRIBUTION_TABLE_COLUMNS),
  }
}

async function loadTableSchemas(host, database, args) {
  const schemas = {}
  for (const table of ['event_log','final_event_log','event_attribution']) {
    const raw = await executeDDL(host, database, `DESCRIBE TABLE \`${table}\` FORMAT JSONEachRow`, args)
    const rows = parseJsonEachRow(raw)
    schemas[table] = new Set(rows.map(row => row.name))
    console.log(`  ${table}: ${schemas[table].size} 列`)
  }
  return schemas
}

function parseJsonEachRow(raw) {
  return String(raw || '').trim().split('\n').filter(Boolean).map(line => JSON.parse(line))
}

function buildClickHouseRequestOptions(parsed, args) {
  const auth = args.username || args.password
    ? `Basic ${Buffer.from(`${args.username || 'default'}:${args.password || ''}`).toString('base64')}`
    : ''
  return {
    hostname: parsed.hostname,
    port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
    path: parsed.pathname + parsed.search,
    headers: {
      'Content-Type': 'application/json',
      ...(auth ? { Authorization: auth } : {}),
    },
  }
}

function addFinalOnlyColumns(rows, columns) {
  if (!columns.has('$event_unique_id')) return rows
  return rows.map(row => ({ ...row, '$event_unique_id': uuid() }))
}

function prepareRowsForTable(table, rows, columns) {
  const dropped = new Set()
  const prepared = rows.map(row => {
    const out = {}
    for (const [key, value] of Object.entries(row)) {
      if (INTERNAL_COLUMNS.has(key)) continue
      if (columns.has(key)) out[key] = value
      else dropped.add(key)
    }
    return out
  })
  if (dropped.size > 0) {
    console.log(`  ${table}: 跳过当前表不存在的字段 ${Array.from(dropped).sort().join(', ')}`)
  }
  return prepared
}

// ==================== ClickHouse HTTP 客户端 ====================
async function insertBatch(host, database, table, rows, args) {
  const lines = rows.map(r => JSON.stringify(r)).join('\n')
  const url = `${host}/?database=${database}&query=INSERT%20INTO%20${table}%20FORMAT%20JSONEachRow`
  const parsed = new URL(url)
  const mod = parsed.protocol === 'https:' ? https : http
  return new Promise((resolve, reject) => {
    const req = mod.request({
      ...buildClickHouseRequestOptions(parsed, args),
      method: 'POST',
    }, res => {
      let d = ''; res.on('data', c => d += c)
      res.on('end', () => res.statusCode === 200 ? resolve(d) : reject(new Error(`CH ${res.statusCode}: ${d}`)))
    })
    req.on('error', reject); req.write(lines); req.end()
  })
}

async function executeDDL(host, database, sql, args) {
  const parsed = new URL(`${host}/?database=${database}`)
  const mod = parsed.protocol === 'https:' ? https : http
  return new Promise((resolve, reject) => {
    const req = mod.request({
      ...buildClickHouseRequestOptions(parsed, args),
      method: 'POST',
    }, res => {
      let d = ''; res.on('data', c => d += c)
      res.on('end', () => res.statusCode === 200 ? resolve(d) : reject(new Error(`CH DDL ${res.statusCode}: ${d}`)))
    })
    req.on('error', reject); req.write(sql); req.end()
  })
}

// ==================== 主流程 ====================
async function main() {
  const args = parseArgs()
  args.days = Math.max(1, Math.floor(Number(args.days) || 1))
  args.events = Math.max(1, Math.floor(Number(args.events) || 1))
  args.users = Math.max(1, Math.floor(Number(args.users) || 1))
  args.sessions = Math.max(1, Math.floor(Number(args.sessions) || 1))
  args.batch = Math.max(1, Math.floor(Number(args.batch) || 1))
  args.preview = Math.max(1, Math.floor(Number(args.preview) || 1))
  args.dirtyRate = normalizeDirtyRate(args.dirtyRate)

  console.log('=== Probe-X 测试数据生成器 v2 ===')
  console.log('配置:', JSON.stringify(safeArgsForLog(args)))

  let tableSchemas = defaultTableSchemas()
  if (!args.dryRun) {
    console.log('检查 ClickHouse 连接...')
    try { await executeDDL(args.host, args.database, 'SELECT 1', args); console.log('连接成功') }
    catch (e) { console.error('连接失败:', e.message); process.exit(1) }

    console.log('读取 ClickHouse 表结构...')
    try { tableSchemas = await loadTableSchemas(args.host, args.database, args) }
    catch (e) { console.error('读取表结构失败:', e.message); process.exit(1) }

    if (args.clean) {
      console.log('清除旧数据...')
      for (const t of ['event_log','final_event_log','event_attribution']) {
        try { await executeDDL(args.host, args.database, `TRUNCATE TABLE ${t}`, args); console.log(`  ${t} 已清除`) }
        catch (e) { console.warn(`  ${t} 清除失败:`, e.message) }
      }
    }
  }

  // ---- 生成用户 ----
  const users = generateUsers(args.users)
  const allEvents = []

  // ---- 为每个用户分配会话 ----
  console.log('分配用户会话...')
  const now = Date.now()
  const dayStarts = Array.from({ length: args.days }, (_, d) => now - (args.days - 1 - d) * 86400000)
  const targetGeneratedSessions = Math.max(args.sessions, Math.ceil(args.events / 20))
  let generatedSessions = 0

  for (const user of users) {
    // 决定该用户活跃的天数
    const activeDaysSet = new Set()
    const totalActiveDays = user.tier === 'oneoff' ? 1 : user.activeDays || randInt(2,4)
    while (activeDaysSet.size < totalActiveDays && activeDaysSet.size < args.days) {
      activeDaysSet.add(randInt(0, args.days - 1))
    }

    let userSessionCount = 0
    for (const dayIdx of activeDaysSet) {
      const dayBase = dayStarts[dayIdx]
      const sessionsToday = user.tier === 'oneoff'
        ? (userSessionCount === 0 ? 1 : 0)
        : (user.sessionsPerDay || randInt(1, 3))

      for (let si = 0; si < sessionsToday; si++) {
        // 会话起始时间: 8:00-22:00, 有高峰时段分布
        const hour = weightedPick(
          [8,9,10,11,12,13,14,15,16,17,18,19,20,21],
          [2,3,5, 6, 8, 7, 5, 4, 6,10,12,10, 6, 3],
        )
        const minute = randInt(0, 59)
        const sessionStart = dayBase + hour * 3600000 + minute * 60000 + randInt(0, 5000)

        // 同一用户不同会话可能带不同 UTM (比如从不同渠道进入)
        const sessionUtm = (si === 0) ? user.utm : (Math.random() < 0.2 ? {
          source: pick(UTM_SOURCES.filter(Boolean)),
          medium: pick(UTM_MEDIUMS.filter(Boolean)),
          campaign: pick(UTM_CAMPAIGNS.filter(Boolean)),
          term: '', content: '',
        } : null)

        const sessionEvents = generateSession(user, sessionStart, sessionUtm)
        allEvents.push(...sessionEvents)
        userSessionCount++
        generatedSessions++

        if (allEvents.length >= args.events * 1.25 && generatedSessions >= targetGeneratedSessions) break
      }
      if (allEvents.length >= args.events * 1.25 && generatedSessions >= targetGeneratedSessions) break
    }
    if (allEvents.length >= args.events * 1.25 && generatedSessions >= targetGeneratedSessions) break
  }

  let guard = 0
  while ((allEvents.length < args.events || generatedSessions < args.sessions) && guard < args.sessions * 4) {
    const user = pick(users)
    const dayBase = dayStarts[randInt(0, args.days - 1)]
    const sessionStart = dayBase + randInt(8, 22) * 3600000 + randInt(0, 59) * 60000 + randInt(0, 5000)
    const sessionUtm = Math.random() < 0.35 ? {
      source: pick(UTM_SOURCES.filter(Boolean)),
      medium: pick(UTM_MEDIUMS.filter(Boolean)),
      campaign: pick(UTM_CAMPAIGNS.filter(Boolean)),
      term: pick(UTM_TERMS.filter(Boolean)),
      content: pick(UTM_CONTENTS.filter(Boolean)),
    } : user.utm
    allEvents.push(...generateSession(user, sessionStart, sessionUtm))
    generatedSessions++
    guard++
  }

  // 按会话均匀取样，避免简单按时间裁剪导致用户/会话过少
  allEvents.sort((a, b) => a['$service_time'].localeCompare(b['$service_time']))
  const events = selectEvents(allEvents, args.events, args.sessions)
  injectDirtyData(events, args.dirtyRate)

  // ---- 统计报告 ----
  console.log(`\n生成 ${events.length} 条事件`)
  const stats = {
    users: new Set(events.map(e => e['$uid'])).size,
    sessions: new Set(events.map(e => e['$session_id'])).size,
    devices: new Set(events.map(e => e['$device_id'])).size,
  }
  // 用户会话分布
  const userSessionMap = {}
  events.forEach(e => {
    const uid = e['$uid']
    userSessionMap[uid] = userSessionMap[uid] || new Set()
    userSessionMap[uid].add(e['$session_id'])
  })
  const multiSessionUsers = Object.values(userSessionMap).filter(s => s.size > 1).length
  const dirtyEvents = events.filter(e => e.__dirty).length

  console.log(`  独立用户: ${stats.users}`)
  console.log(`  独立会话: ${stats.sessions}`)
  console.log(`  多会话用户: ${multiSessionUsers} (${(multiSessionUsers/stats.users*100).toFixed(1)}%)`)
  console.log(`  平均每用户会话数: ${(stats.sessions/stats.users).toFixed(2)}`)
  console.log(`  独立设备: ${stats.devices}`)
  console.log(`  脏数据: ${dirtyEvents} (${(dirtyEvents/events.length*100).toFixed(2)}%)`)

  // 事件类型分布
  const eventCounts = {}
  events.forEach(e => { eventCounts[e['$event_name']] = (eventCounts[e['$event_name']] || 0) + 1 })
  console.log('  事件类型分布:')
  Object.entries(eventCounts).sort((a,b) => b[1]-a[1]).forEach(([n,c]) => console.log(`    ${n}: ${c} (${(c/events.length*100).toFixed(1)}%)`))

  // 设备分布
  const devCounts = {}
  events.forEach(e => { devCounts[e['$device']] = (devCounts[e['$device']] || 0) + 1 })
  console.log('  设备分布:')
  Object.entries(devCounts).forEach(([d,c]) => console.log(`    ${d}: ${c} (${(c/events.length*100).toFixed(1)}%)`))

  // UTM 分布
  const utmCounts = {}
  events.filter(e => e['$utm_source']).forEach(e => { utmCounts[e['$utm_source']] = (utmCounts[e['$utm_source']] || 0) + 1 })
  console.log('  UTM 来源分布:')
  Object.entries(utmCounts).sort((a,b) => b[1]-a[1]).slice(0,5).forEach(([s,c]) => console.log(`    ${s}: ${c}`))

  // 漏斗转化
  const funnelSteps = ['/', '/search', '/product/detail', '/cart', '/order/create', '/order/pay', '/order/result']
  const funnelCounts = funnelSteps.map(path => events.filter(e => e['$web_pathname'] === path && e['$event_name'] === 'page_view').length)
  console.log('  漏斗转化:')
  funnelSteps.forEach((path, i) => console.log(`    ${path}: ${funnelCounts[i]}${i > 0 ? ` (${funnelCounts[i] ? (funnelCounts[i]/funnelCounts[0]*100).toFixed(1)+'%' : '0%'})` : ''}`))

  // ---- final_event_log ----
  const finalEvents = addFinalOnlyColumns(events, tableSchemas.final_event_log)
  // ---- attribution ----
  const attributionRows = generateAttributionData(events)
  const tableRows = {
    event_log: prepareRowsForTable('event_log', events, tableSchemas.event_log),
    final_event_log: prepareRowsForTable('final_event_log', finalEvents, tableSchemas.final_event_log),
    event_attribution: prepareRowsForTable('event_attribution', attributionRows, tableSchemas.event_attribution),
  }

  if (args.dryRun) {
    console.log('\n=== Dry Run ===')
    process.stdout.write(JSON.stringify({
      event_log: tableRows.event_log.slice(0,args.preview),
      final_event_log: tableRows.final_event_log.slice(0,args.preview),
      event_attribution: tableRows.event_attribution.slice(0,args.preview),
    }, null, 2))
    return
  }

  // ---- 批量插入 ----
  for (const [table, data] of Object.entries(tableRows)) {
    if (data.length === 0) continue
    console.log(`\n插入 ${table} (${data.length} 条)...`)
    let done = 0
    for (let i = 0; i < data.length; i += args.batch) {
      const batch = data.slice(i, i + args.batch)
      try {
        await insertBatch(args.host, args.database, table, batch, args)
        done += batch.length
        process.stdout.write(`  ${table}: ${done}/${data.length}\n`)
      } catch (e) { console.error(`  批次 ${i} 失败:`, e.message) }
    }
  }

  console.log('\n=== 完成 ===')
  console.log(`时间范围: ${events[0]['$service_time'].slice(0,10)} ~ ${events[events.length-1]['$service_time'].slice(0,10)}`)
  console.log(`多会话用户占比: ${(multiSessionUsers/stats.users*100).toFixed(1)}%`)
}

main().catch(e => { console.error('失败:', e); process.exit(1) })
