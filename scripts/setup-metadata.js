/**
 * Probe-X 电商 Demo 埋点系统初始化脚本 v2
 * 通过真实 API 创建：项目、SPM四级结构、SCM四级结构、事件元数据、属性元数据
 * 
 * API 关键发现：
 * - SPM/SCM 用 parentCode (不是 parentId) 引用父节点
 * - 返回 code (8位随机字符串) 作为唯一标识，不返回 id
 * - node create 需要 level 参数 (1|2|3|4)
 */
const crypto = require('crypto');
const mysql = require('mysql2/promise');

const API = 'http://localhost:8101/api';

const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_DATABASE = 'probe_x' } = process.env;

// 数据库连接信息从环境变量读取，缺省时直接报错退出
async function createDbConnection() {
  const missing = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD'].filter(k => !process.env[k]);
  if (missing.length > 0) {
    console.error(`  ❌ 缺少环境变量 ${missing.join(', ')}，请先设置数据库连接信息`);
    process.exit(1);
  }
  return mysql.createConnection({
    host: DB_HOST,
    port: Number(DB_PORT),
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_DATABASE,
  });
}

async function request(method, path, body = null, token = '') {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (token) opts.headers['Authorization'] = `Bearer ${token}`;
  if (body) opts.body = JSON.stringify(body);
  try {
    const res = await fetch(`${API}${path}`, opts);
    return await res.json();
  } catch (e) {
    return { code: -1, message: e.message };
  }
}

async function login() {
  // 通过正常登录 API 获取 token，管理员凭据与前端加密所需的 SALT/HMAC_SECRET 均从环境变量读取
  const { ADMIN_USERNAME, ADMIN_PASSWORD, SALT, HMAC_SECRET } = process.env;
  const missing = ['ADMIN_USERNAME', 'ADMIN_PASSWORD', 'SALT', 'HMAC_SECRET'].filter(k => !process.env[k]);
  if (missing.length > 0) {
    console.error(`  ❌ 缺少环境变量: ${missing.join(', ')}`);
    return null;
  }

  // 与前端登录一致：先计算前端哈希 hmacSHA(password + SALT, 'sha512', HMAC_SECRET)
  const frontHash = crypto.createHmac('sha512', HMAC_SECRET)
    .update(ADMIN_PASSWORD + SALT).digest('hex');

  const res = await request('POST', '/user/login', { username: ADMIN_USERNAME, password: frontHash });
  if (res.code === 200 && res.data) {
    const token = res.data.accessToken;
    console.log(`  ✅ Token: ${token?.substring(0, 30)}...`);
    return token;
  }
  console.log(`  ❌ Login failed:`, JSON.stringify(res));
  return null;
}

async function cleanOldData(token) {
  console.log('\n🧹 清理旧数据...');
  // 清空 tracking_node, system, project, meta_event, meta_property
  const conn = await createDbConnection();
  await conn.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const table of ['tracking_node', 'system', 'project', 'meta_event', 'meta_property', 'event_property_relation', 'user_project_relation']) {
    await conn.query(`TRUNCATE TABLE \`${table}\``);
  }
  await conn.query('SET FOREIGN_KEY_CHECKS = 1');
  await conn.end();
  console.log('  ✅ 旧数据已清理');
}

async function createProject(token) {
  console.log('\n🏢 创建电商项目...');
  const res = await request('POST', '/project/create', {
    projectName: '电商演示系统',
    projectKey: 'ecommerce-demo',
    description: 'Probe-X 电商演示平台',
    isEnable: 1,
  }, token);
  console.log(`  项目: ${res.code === 200 ? '✅' : '⚠️ ' + res.message}`);
}

async function createSPM(token) {
  console.log('\n📍 创建 SPM 四级结构...');

  // 1. 创建业务线 (level 1)
  const bizRes = await request('POST', '/tracking/spm/business/create', {
    name: 'ecommerce', description: '电商业务线',
  }, token);
  
  if (bizRes.code !== 200) {
    console.log(`  ⚠️ 业务线创建失败: ${bizRes.message}`);
    return;
  }
  const bizCode = bizRes.data.code;
  console.log(`  ✅ 业务线 ecommerce (code: ${bizCode})`);

  let total = 1;

  // 递归创建子节点
  async function createChild(name, description, parentCode, level) {
    const res = await request('POST', '/tracking/spm/node/create', {
      name, description, parentCode, level,
    }, token);
    if (res.code === 200) {
      total++;
      console.log(`  ${'  '.repeat(level - 1)}✅ L${level} ${name} (code: ${res.data.code})`);
      return res.data.code;
    } else {
      console.log(`  ${'  '.repeat(level - 1)}⚠️ L${level} ${name}: ${res.message}`);
      return null;
    }
  }

  // Level 2: 页面
  const pages = [
    { name: '首页', code: 'home', desc: '电商首页', modules: [
      { name: '推荐商品', desc: '推荐商品区域', points: ['商品卡片点击', '加入购物车'] },
      { name: '分类导航', desc: '分类导航区域', points: ['分类点击'] },
    ]},
    { name: '商品列表', code: 'products', desc: '商品列表页', modules: [
      { name: '商品卡片', desc: '商品卡片区域', points: ['点击商品', '快速加购'] },
      { name: '筛选器', desc: '筛选器区域', points: ['分类筛选', '品牌筛选', '排序切换'] },
    ]},
    { name: '商品详情', code: 'product_detail', desc: '商品详情页', modules: [
      { name: '购买区域', desc: '购买操作区域', points: ['加入购物车', '立即购买'] },
    ]},
    { name: '购物车', code: 'cart_page', desc: '购物车页', modules: [
      { name: '商品列表', desc: '购物车商品列表', points: ['修改数量', '删除商品'] },
      { name: '结算区域', desc: '结算操作区域', points: ['去结算'] },
    ]},
    { name: '结算页', code: 'checkout', desc: '结算页面', modules: [
      { name: '支付区域', desc: '支付操作区域', points: ['提交订单'] },
    ]},
    { name: '搜索结果', code: 'search', desc: '搜索结果页', modules: [
      { name: '结果列表', desc: '搜索结果列表区域', points: ['点击商品'] },
    ]},
  ];

  for (const page of pages) {
    const pageCode = await createChild(page.name, page.desc, bizCode, 2);
    if (pageCode && page.modules) {
      for (const mod of page.modules) {
        const modCode = await createChild(mod.name, mod.desc, pageCode, 3);
        if (modCode && mod.points) {
          for (const point of mod.points) {
            await createChild(point, point + '点位', modCode, 4);
          }
        }
      }
    }
  }

  console.log(`  📊 共创建 ${total} 个 SPM 节点`);
}

async function createSCM(token) {
  console.log('\n🏷️ 创建 SCM 四级结构...');

  const bizRes = await request('POST', '/tracking/scm/business/create', {
    name: '自然流量', description: '自然流量来源',
  }, token);

  if (bizRes.code !== 200) {
    console.log(`  ⚠️ 业务线创建失败: ${bizRes.message}`);
    return;
  }
  const bizCode = bizRes.data.code;
  console.log(`  ✅ 业务线 自然流量 (code: ${bizCode})`);

  let total = 1;

  async function createChild(name, description, parentCode, level) {
    const res = await request('POST', '/tracking/scm/node/create', {
      name, description, parentCode, level,
    }, token);
    if (res.code === 200) {
      total++;
      return res.data.code;
    }
    return null;
  }

  const methods = [
    { name: '算法推荐', desc: '算法推荐配置', types: [
      { name: '商品', desc: '商品内容类型', items: ['热门商品', '新品推荐'] },
    ]},
    { name: '用户搜索', desc: '用户搜索配置', types: [
      { name: '搜索结果', desc: '搜索结果内容', items: ['关键词匹配'] },
    ]},
    { name: '直接访问', desc: '直接访问配置', types: [
      { name: '首页入口', desc: '首页入口内容', items: ['推荐位'] },
    ]},
  ];

  for (const m of methods) {
    const mCode = await createChild(m.name, m.desc, bizCode, 2);
    if (mCode && m.types) {
      for (const t of m.types) {
        const tCode = await createChild(t.name, t.desc, mCode, 3);
        if (tCode && t.items) {
          for (const item of t.items) {
            await createChild(item, item + 'ID', tCode, 4);
          }
        }
      }
    }
  }

  console.log(`  📊 共创建 ${total} 个 SCM 节点`);
}

async function createEvents(token) {
  console.log('\n📊 注册事件元数据...');
  const events = [
    'page_view', 'product_view', 'product_click', 'add_to_cart',
    'cart_action', 'search', 'purchase', 'button_click',
    'click', 'page_stay', 'scroll', 'form_submit',
  ];
  let created = 0;
  for (const name of events) {
    const res = await request('POST', '/event/register', {
      eventName: name, eventAlias: name, description: `电商${name}事件`,
    }, token);
    if (res.code === 200) created++;
    else console.log(`  ⚠️ ${name}: ${res.message}`);
  }
  console.log(`  ✅ ${created}/${events.length} 个事件`);
}

async function createProperties(token) {
  console.log('\n🏷️ 创建属性元数据...');
  const props = [
    { name: 'product_id', type: 'string' }, { name: 'product_name', type: 'string' },
    { name: 'product_price', type: 'number' }, { name: 'product_category', type: 'string' },
    { name: 'product_brand', type: 'string' }, { name: 'quantity', type: 'number' },
    { name: 'total_value', type: 'number' }, { name: 'total_amount', type: 'number' },
    { name: 'order_id', type: 'string' }, { name: 'keyword', type: 'string' },
    { name: 'page_name', type: 'string' }, { name: 'click_type', type: 'string' },
    { name: 'button_name', type: 'string' }, { name: 'button_location', type: 'string' },
    { name: 'action', type: 'string' }, { name: 'payment_method', type: 'string' },
    { name: 'source', type: 'string' }, { name: 'item_count', type: 'number' },
  ];
  let created = 0;
  for (const p of props) {
    const res = await request('POST', '/property/create', {
      propertyName: p.name, propertyAlias: p.name, propertyType: p.type, businessType: p.type === 'number' ? 'measure' : 'dimension',
    }, token);
    if (res.code === 200) created++;
    else console.log(`  ⚠️ ${p.name}: ${res.message}`);
  }
  console.log(`  ✅ ${created}/${props.length} 个属性`);
}

async function main() {
  console.log('=== Probe-X 电商 Demo 埋点系统初始化 v2 ===\n');
  const token = await login();
  if (!token) return;

  await cleanOldData(token);
  await createProject(token);
  await createSPM(token);
  await createSCM(token);
  await createEvents(token);
  await createProperties(token);

  // 验证
  console.log('\n📋 数据验证:');
  const conn = await createDbConnection();
  for (const table of ['project', 'tracking_node', 'meta_event', 'meta_property']) {
    const [rows] = await conn.query(`SELECT COUNT(*) as cnt FROM \`${table}\``);
    console.log(`  ${table}: ${rows[0].cnt} rows`);
  }
  await conn.end();

  console.log('\n✅ 初始化完成！');
}

main().catch(console.error);
