#!/usr/bin/env node
/**
 * Probe-X 元数据同步脚本
 *
 * 将 generate-test-data.js 中用到的事件、属性、SPM/SCM节点同步到 MySQL 元数据表。
 * 与 generate-test-data.js 共享同一套常量定义，确保数据一致性。
 *
 * 用法:
 *   node scripts/sync-metadata.js [选项]
 *
 * 选项:
 *   --host=127.0.0.1       MySQL 主机 (默认 127.0.0.1)
 *   --port=3306            MySQL 端口 (默认 3306)
 *   --user=root            MySQL 用户 (默认 root)
 *   --password=xxx         MySQL 密码
 *   --database=probe_x     MySQL 数据库 (默认 probe_x)
 *   --dry-run              只打印 SQL 不执行
 *   --clean                清除已有的测试元数据再插入
 *   --skip-events          跳过事件同步
 *   --skip-properties      跳过属性同步
 *   --skip-tracking        跳过 SPM/SCM 节点同步
 *
 * 示例:
 *   node scripts/sync-metadata.js --host=localhost --port=3306 --password=your_password
 *   node scripts/sync-metadata.js --dry-run
 *   node scripts/sync-metadata.js --clean --skip-tracking
 */

const mysql = require('mysql2/promise')

// ==================== 与 generate-test-data.js 保持一致的常量 ====================

// 测试数据中使用的事件名（对应 pickActionForPage 和路径类型）
const TEST_EVENTS = [
  { name: 'page_view',        aliases: '页面浏览',    remark: '用户访问一个页面时触发' },
  { name: 'click',            aliases: '点击',        remark: '用户点击页面元素时触发' },
  { name: 'scroll',           aliases: '滚动',        remark: '用户滚动页面时触发' },
  { name: 'form_submit',      aliases: '表单提交',    remark: '用户提交表单时触发' },
  { name: 'error',            aliases: '错误',        remark: '前端 JS 错误捕获' },
  { name: 'page_stay',        aliases: '页面停留',    remark: '用户离开页面时记录停留时长' },
  { name: 'heartbeat',        aliases: '心跳',        remark: '定期上报用户在线状态' },
  { name: 'element_click',    aliases: '元素点击',    remark: '用户点击特定可交互元素' },
  { name: 'input_change',     aliases: '输入变更',    remark: '用户在输入框中修改内容' },
  { name: 'purchase',         aliases: '购买',        remark: '用户完成支付下单' },
  { name: 'add_to_cart',      aliases: '加入购物车',  remark: '用户将商品加入购物车' },
  { name: 'search',           aliases: '搜索',        remark: '用户在搜索框输入并提交搜索' },
  { name: 'login',            aliases: '登录',        remark: '用户登录系统' },
  { name: 'signup',           aliases: '注册',        remark: '用户完成注册' },
  { name: 'share',            aliases: '分享',        remark: '用户分享页面或商品' },
  { name: 'download',         aliases: '下载',        remark: '用户下载文件' },
  { name: 'video_play',       aliases: '视频播放',    remark: '用户开始播放视频' },
  { name: 'video_pause',      aliases: '视频暂停',    remark: '用户暂停视频播放' },
  { name: 'ad_click',         aliases: '广告点击',    remark: '用户点击广告位' },
  { name: 'notification_receive', aliases: '通知接收', remark: '用户收到推送通知' },
  { name: 'coupon_use',       aliases: '优惠券使用',  remark: '用户使用优惠券' },
  { name: 'refund_apply',     aliases: '退款申请',    remark: '用户发起退款申请' },
]

// 测试数据中使用的业务属性（对应 generate-test-data.js 中的 event 字段）
const TEST_PROPERTIES = [
  // 业务属性（动态添加到 ClickHouse 的列）
  { name: 'stay_time',       type: 'number',  biz: 2, comment: '页面停留时长(毫秒)' },
  { name: 'page_url',        type: 'string',  biz: 2, comment: '页面完整URL' },
  { name: 'page_path',       type: 'string',  biz: 2, comment: '页面路径' },
  { name: 'search_keyword',  type: 'string',  biz: 2, comment: '搜索关键词' },
  { name: 'product_id',      type: 'string',  biz: 2, comment: '商品ID' },
  { name: 'product_name',    type: 'string',  biz: 2, comment: '商品名称' },
  { name: 'category_id',     type: 'string',  biz: 2, comment: '分类ID' },
  { name: 'order_id',        type: 'string',  biz: 2, comment: '订单ID' },
  { name: 'order_amount',    type: 'number',  biz: 2, comment: '订单金额(分)' },
  { name: 'payment_method',  type: 'string',  biz: 2, comment: '支付方式' },
  { name: 'coupon_id',       type: 'string',  biz: 2, comment: '优惠券ID' },
  { name: 'video_duration',  type: 'number',  biz: 2, comment: '视频时长(毫秒)' },
  { name: 'share_channel',   type: 'string',  biz: 2, comment: '分享渠道' },
  { name: 'error_message',   type: 'string',  biz: 2, comment: '错误信息' },
  { name: 'error_stack',     type: 'string',  biz: 2, comment: '错误堆栈' },
]

// SPM 节点层级定义（与 generate-test-data.js 中的 SPM_SEGMENTS 完全对应）
// 格式: [code, name, description, level, parentCode]
const SPM_TREE = [
  // A 段 - 业务模块（level 1, 无 parent）
  { code: 'home',     name: '首页模块',   desc: '首页相关功能',      level: 1, parent: null },
  { code: 'product',  name: '商品模块',   desc: '商品浏览相关功能',  level: 1, parent: null },
  { code: 'user',     name: '用户模块',   desc: '用户中心相关功能',  level: 1, parent: null },
  { code: 'activity', name: '活动模块',   desc: '营销活动相关功能',  level: 1, parent: null },
  { code: 'system',   name: '系统模块',   desc: '系统管理相关功能',  level: 1, parent: null },

  // B 段 - 功能区块（level 2, parent = A段 code）
  { code: 'list',     name: '列表区块',   desc: '列表展示区域',      level: 2, parent: 'product' },
  { code: 'detail',   name: '详情区块',   desc: '详情展示区域',      level: 2, parent: 'product' },
  { code: 'cart',     name: '购物车区块', desc: '购物车功能区域',    level: 2, parent: 'product' },
  { code: 'order',    name: '订单区块',   desc: '订单管理区域',      level: 2, parent: 'product' },
  { code: 'profile',  name: '个人中心区块', desc: '个人中心区域',    level: 2, parent: 'user' },
  { code: 'search',   name: '搜索区块',   desc: '搜索功能区域',      level: 2, parent: 'home' },
  { code: 'guide',    name: '引导区块',   desc: '新手引导区域',      level: 2, parent: 'home' },

  // C 段 - 交互元素（level 3, parent = B段 code）
  { code: 'item',     name: '列表项',     desc: '列表中的单个条目',  level: 3, parent: 'list' },
  { code: 'btn',      name: '按钮',       desc: '可点击的按钮元素',  level: 3, parent: 'detail' },
  { code: 'img',      name: '图片',       desc: '可交互的图片元素',  level: 3, parent: 'detail' },
  { code: 'form',     name: '表单',       desc: '可提交的表单区域',  level: 3, parent: 'order' },
  { code: 'tab',      name: '标签页',     desc: '可切换的标签页',    level: 3, parent: 'list' },
  { code: 'card',     name: '卡片',       desc: '信息卡片组件',      level: 3, parent: 'list' },
  { code: 'modal',    name: '弹窗',       desc: '模态弹窗组件',      level: 3, parent: 'detail' },
  { code: 'nav',      name: '导航',       desc: '导航栏组件',        level: 3, parent: 'home' },

  // D 段 - 用户操作（level 4, parent = C段 code）
  { code: 'buy',      name: '购买',       desc: '购买操作',          level: 4, parent: 'btn' },
  { code: 'submit',   name: '提交',       desc: '提交操作',          level: 4, parent: 'form' },
  { code: 'click',    name: '点击',       desc: '通用点击操作',      level: 4, parent: 'btn' },
  { code: 'view',     name: '查看',       desc: '查看详情操作',      level: 4, parent: 'item' },
  { code: 'share',    name: '分享',       desc: '分享操作',          level: 4, parent: 'btn' },
  { code: 'filter',   name: '筛选',       desc: '筛选过滤操作',      level: 4, parent: 'nav' },
  { code: 'sort',     name: '排序',       desc: '排序操作',          level: 4, parent: 'nav' },
  { code: 'add',      name: '添加',       desc: '添加操作',          level: 4, parent: 'btn' },
]

// SCM 节点层级定义（与 generate-test-data.js 中的 SCM_SEGMENTS 完全对应）
const SCM_TREE = [
  // A 段 - 渠道（level 1）
  { code: 'channel_web',  name: 'Web渠道',     desc: 'PC端Web访问渠道',   level: 1, parent: null },
  { code: 'channel_app',  name: 'App渠道',     desc: '移动端App访问渠道', level: 1, parent: null },
  { code: 'channel_mini', name: '小程序渠道',  desc: '微信小程序访问渠道', level: 1, parent: null },

  // B 段 - 站点（level 2）
  { code: 'site_main',     name: '主站',       desc: '主站站点',          level: 2, parent: 'channel_web' },
  { code: 'site_activity', name: '活动站',     desc: '营销活动专用站点',  level: 2, parent: 'channel_web' },
  { code: 'site_mobile',   name: '移动站',     desc: '移动端适配站点',    level: 2, parent: 'channel_app' },

  // C 段 - 页面（level 3）
  { code: 'page_home',    name: '首页',        desc: '站点首页',          level: 3, parent: 'site_main' },
  { code: 'page_product', name: '商品页',      desc: '商品相关页面',      level: 3, parent: 'site_main' },
  { code: 'page_order',   name: '订单页',      desc: '订单相关页面',      level: 3, parent: 'site_main' },

  // D 段 - 模块（level 4）
  { code: 'module_header',   name: '顶部导航',  desc: '页面顶部导航区域', level: 4, parent: 'page_home' },
  { code: 'module_content',  name: '内容区域',  desc: '页面主体内容区域', level: 4, parent: 'page_product' },
  { code: 'module_sidebar',  name: '侧边栏',    desc: '页面侧边栏区域',   level: 4, parent: 'page_order' },
]

// ==================== 配置解析 ====================
function parseArgs() {
  const args = {
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: '',
    database: 'probe_x',
    dryRun: false,
    clean: false,
    skipEvents: false,
    skipProperties: false,
    skipTracking: false,
  }
  for (const raw of process.argv.slice(2)) {
    const m = raw.match(/^--(.+?)(?:=(.+))?$/)
    if (!m) continue
    const [, k, v] = m
    const key = k.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
    if (v === undefined) { args[key] = true; continue }
    args[key] = isNaN(Number(v)) ? v : Number(v)
  }
  return args
}

// ==================== SQL 执行 ====================
async function execute(conn, sql, params) {
  const [result] = await conn.execute(sql, params)
  return result
}

async function upsertMetaEvent(conn, events) {
  let inserted = 0, skipped = 0
  for (const ev of events) {
    try {
      await execute(conn,
        `INSERT INTO meta_event (event_name, event_aliases, event_remark, status, create_user_id, update_user_id)
         VALUES (?, ?, ?, 1, 1, 1)
         ON DUPLICATE KEY UPDATE event_aliases = VALUES(event_aliases), event_remark = VALUES(event_remark)`,
        [ev.name, ev.aliases, ev.remark],
      )
      inserted++
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') { skipped++; continue }
      throw e
    }
  }
  return { inserted, skipped }
}

async function upsertMetaProperty(conn, properties) {
  let inserted = 0, skipped = 0
  for (const prop of properties) {
    try {
      await execute(conn,
        `INSERT INTO meta_property (property_name, property_type, type, comment, status, create_user_id, update_user_id)
         VALUES (?, ?, ?, ?, 1, 1, 1)
         ON DUPLICATE KEY UPDATE property_type = VALUES(property_type), comment = VALUES(comment)`,
        [prop.name, prop.type, prop.biz, prop.comment],
      )
      inserted++
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') { skipped++; continue }
      throw e
    }
  }
  return { inserted, skipped }
}

// 生成 8 位随机编码（与 TrackingNodeService.generateRandomString 一致）
function generateCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

async function upsertTrackingNodes(conn, tree, type) {
  // 先查出已有的节点（按 type 分组），避免重复插入
  const [existing] = await conn.execute(
    'SELECT code, name, level, parentCode FROM tracking_node WHERE type = ?',
    [type],
  )
  const existingMap = new Map()
  for (const row of existing) {
    // 用 name+level+parentCode 作为自然键匹配
    const key = `${row.name}|${row.level}|${row.parentCode || ''}`
    existingMap.set(key, row)
  }

  // level -> Map<name, code> 用于查找父节点 code
  const codeMap = new Map()

  let inserted = 0, skipped = 0, systemCreated = 0

  // 按 level 顺序插入（确保父节点先插入）
  const sorted = [...tree].sort((a, b) => a.level - b.level)

  for (const node of sorted) {
    // 查找父节点 code
    let parentCode = null
    if (node.parent) {
      parentCode = codeMap.get(node.parent)
      if (!parentCode) {
        console.warn(`  [WARN] 父节点 "${node.parent}" 未找到 code，跳过 ${type.toUpperCase()} 节点 "${node.name}"`)
        skipped++
        continue
      }
    }

    // 检查是否已存在
    const naturalKey = `${node.name}|${node.level}|${parentCode || ''}`
    if (existingMap.has(naturalKey)) {
      const existingNode = existingMap.get(naturalKey)
      codeMap.set(node.code, existingNode.code)
      skipped++
      continue
    }

    // 生成新 code
    const newCode = generateCode()
    codeMap.set(node.code, newCode)

    await execute(conn,
      `INSERT INTO tracking_node (code, type, level, name, description, parentCode, status, create_user_id, update_user_id)
       VALUES (?, ?, ?, ?, ?, ?, 1, 1, 1)`,
      [newCode, type, node.level, node.name, node.desc, parentCode],
    )
    inserted++

    // SPM level 1 节点同时创建 system 记录
    if (type === 'spm' && node.level === 1) {
      try {
        await execute(conn,
          `INSERT INTO system (system_key, system_name, description, tracking_node_code, is_enable)
           VALUES (?, ?, ?, ?, 1)
           ON DUPLICATE KEY UPDATE system_name = VALUES(system_name)`,
          [newCode, node.name, node.desc, newCode],
        )
        systemCreated++
      } catch (e) {
        if (e.code !== 'ER_DUP_ENTRY') throw e
      }
    }
  }

  return { inserted, skipped, systemCreated }
}

async function upsertEventPropertyRelations(conn, events, properties) {
  // 为每个事件关联所有公共属性（$ 开头的系统属性）
  // 以及按事件类型关联相关业务属性
  const relations = []

  const commonProps = properties.filter(p => p.name.startsWith('$'))
  const businessProps = properties.filter(p => !p.name.startsWith('$'))

  // 所有事件都关联公共属性
  for (const ev of events) {
    for (const prop of commonProps) {
      relations.push({ event: ev.name, property: prop.name, remark: '' })
    }
  }

  // 按事件类型关联业务属性
  const eventPropertyMap = {
    'page_view':     ['page_url', 'page_path'],
    'page_stay':     ['stay_time', 'page_url', 'page_path'],
    'search':        ['search_keyword'],
    'add_to_cart':   ['product_id', 'product_name'],
    'purchase':      ['order_id', 'order_amount', 'payment_method', 'product_id'],
    'coupon_use':    ['coupon_id'],
    'video_play':    ['video_duration'],
    'video_pause':   ['video_duration'],
    'share':         ['share_channel'],
    'error':         ['error_message', 'error_stack'],
    'download':      ['page_url'],
    'ad_click':      ['page_url', 'page_path'],
  }

  const propNamesSet = new Set(properties.map(p => p.name))
  for (const [eventName, propNames_] of Object.entries(eventPropertyMap)) {
    for (const propName of propNames_) {
      if (propNamesSet.has(propName)) {
        relations.push({ event: eventName, property: propName, remark: '' })
      }
    }
  }

  // event_property_relation 没有 (event_name, property_name) 唯一约束，先查再插
  const [existing] = await conn.execute(
    'SELECT event_name, property_name FROM event_property_relation',
  )
  const existingSet = new Set(existing.map(r => `${r.event_name}|${r.property_name}`))

  let inserted = 0, skipped = 0
  for (const rel of relations) {
    const key = `${rel.event}|${rel.property}`
    if (existingSet.has(key)) { skipped++; continue }
    try {
      await execute(conn,
        `INSERT INTO event_property_relation (event_name, property_name, event_property_remark, status, create_user_id, update_user_id)
         VALUES (?, ?, ?, 1, 1, 1)`,
        [rel.event, rel.property, rel.remark],
      )
      existingSet.add(key)
      inserted++
    } catch (e) {
      console.warn(`  [WARN] 关联 ${rel.event} <-> ${rel.property} 插入失败: ${e.message}`)
      skipped++
    }
  }
  return { inserted, skipped }
}

// ==================== 主流程 ====================
async function main() {
  const args = parseArgs()
  console.log('=== Probe-X 元数据同步脚本 ===')
  console.log('配置:', { ...args, password: args.password ? '***' : '' })

  if (args.dryRun) {
    console.log('\n--- [Dry Run] 将要执行的 SQL 预览 ---')
    console.log(`\n# meta_event: ${TEST_EVENTS.length} 条事件`)
    for (const ev of TEST_EVENTS) {
      console.log(`  INSERT INTO meta_event (event_name, event_aliases, event_remark) VALUES ('${ev.name}', '${ev.aliases}', '${ev.remark}')`)
    }
    console.log(`\n# meta_property: ${TEST_PROPERTIES.length} 条属性`)
    for (const p of TEST_PROPERTIES) {
      console.log(`  INSERT INTO meta_property (property_name, property_type, type, comment) VALUES ('${p.name}', '${p.type}', ${p.biz}, '${p.comment}')`)
    }
    console.log(`\n# tracking_node (SPM): ${SPM_TREE.length} 个节点`)
    for (const n of SPM_TREE) {
      console.log(`  [L${n.level}] ${n.code} -> ${n.name} (parent: ${n.parent || 'NULL'})`)
    }
    console.log(`\n# tracking_node (SCM): ${SCM_TREE.length} 个节点`)
    for (const n of SCM_TREE) {
      console.log(`  [L${n.level}] ${n.code} -> ${n.name} (parent: ${n.parent || 'NULL'})`)
    }
    return
  }

  // 连接 MySQL
  console.log(`\n连接 MySQL: ${args.host}:${args.port}/${args.database}`)
  const conn = await mysql.createConnection({
    host: args.host,
    port: args.port,
    user: args.user,
    password: args.password,
    database: args.database,
    charset: 'utf8mb4',
  })
  console.log('MySQL 连接成功')

  try {

  // clean 模式
  if (args.clean) {
    // 安全检查：非 localhost 需要显式 --force
    const isLocalhost = ['localhost', '127.0.0.1'].includes(args.host)
    if (!isLocalhost && !args.force) {
      console.error(`错误: --clean 目标为远程主机 ${args.host}，请添加 --force 确认`)
      process.exit(1)
    }
    console.log('\n清除已有测试元数据...')
    // 注意顺序: 先删子表再删父表
    await execute(conn, 'DELETE FROM event_property_relation WHERE create_user_id = 1')
    await execute(conn, 'DELETE FROM meta_event WHERE create_user_id = 1')
    await execute(conn, 'DELETE FROM meta_property WHERE create_user_id = 1')
    await execute(conn, 'DELETE FROM tracking_node WHERE create_user_id = 1')
    console.log('已清除')
  }

  // 同步事件
  if (!args.skipEvents) {
    console.log(`\n同步 ${TEST_EVENTS.length} 个事件到 meta_event ...`)
    const evResult = await upsertMetaEvent(conn, TEST_EVENTS)
    console.log(`  新增: ${evResult.inserted}, 跳过(已存在): ${evResult.skipped}`)
  }

  // 同步属性
  if (!args.skipProperties) {
    console.log(`\n同步 ${TEST_PROPERTIES.length} 个属性到 meta_property ...`)
    const propResult = await upsertMetaProperty(conn, TEST_PROPERTIES)
    console.log(`  新增: ${propResult.inserted}, 跳过(已存在): ${propResult.skipped}`)
  }

  // 同步 SPM/SCM 节点
  if (!args.skipTracking) {
    console.log(`\n同步 ${SPM_TREE.length} 个 SPM 节点到 tracking_node ...`)
    const spmResult = await upsertTrackingNodes(conn, SPM_TREE, 'spm')
    console.log(`  新增: ${spmResult.inserted}, 跳过(已存在): ${spmResult.skipped}, 关联 System: ${spmResult.systemCreated}`)

    console.log(`\n同步 ${SCM_TREE.length} 个 SCM 节点到 tracking_node ...`)
    const scmResult = await upsertTrackingNodes(conn, SCM_TREE, 'scm')
    console.log(`  新增: ${scmResult.inserted}, 跳过(已存在): ${scmResult.skipped}`)
  }

  // 同步事件-属性关联
  if (!args.skipEvents && !args.skipProperties) {
    const totalEvents = args.skipEvents ? 0 : TEST_EVENTS.length
    const totalProps = args.skipProperties ? 0 : TEST_PROPERTIES.length
    if (totalEvents > 0 && totalProps > 0) {
      console.log('\n同步事件-属性关联到 event_property_relation ...')
      const relResult = await upsertEventPropertyRelations(conn, TEST_EVENTS, TEST_PROPERTIES)
      console.log(`  新增: ${relResult.inserted}, 跳过(已存在): ${relResult.skipped}`)
    }
  }

  } finally {
    await conn.end()
    console.log('\n=== 元数据同步完成 ===')
  }
}

main().catch(e => {
  console.error('同步失败:', e)
  process.exit(1)
})