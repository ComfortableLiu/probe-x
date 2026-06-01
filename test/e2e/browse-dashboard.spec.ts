import { test } from '@playwright/test';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

test.setTimeout(300000); // 5分钟

const SCREENSHOT_DIR = 'test/screenshots/manual-browse';
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

// 生成 JWT token
function generateTokens() {
  const result = execSync(
    `NODE_PATH=/Users/xiaoyao/.workbuddy/binaries/node/workspace/node_modules /Users/xiaoyao/.workbuddy/binaries/node/versions/22.22.2/bin/node -e "
const jwt = require('jsonwebtoken');
const SECRET = 'r4r99sQjYGj5srofcVe6CHZXeI4hKMCp1kZDNjTOiCNTRdBhWXzuK4JSiHyFD9I4';
const ts = Date.now();
const at = jwt.sign({ userId: 1, username: 'admin', tokenType: 'access', clientId: 'probe-x', jti: 'browse-' + ts }, SECRET, { expiresIn: '24h' });
const rt = jwt.sign({ userId: 1, username: 'admin', tokenType: 'refresh', clientId: 'probe-x', jti: 'browse-r-' + ts }, SECRET, { expiresIn: '7d' });
console.log(JSON.stringify({ at, rt }));
"`,
    { encoding: 'utf8' }
  ).trim();
  return JSON.parse(result);
}

const tokens = generateTokens();

// 客户端导航（解决 SPA lazy-loading 问题）
async function navigateClient(page: any, targetPath: string) {
  await page.evaluate((p: string) => {
    window.history.pushState({}, '', p);
    window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
  }, targetPath);
  await page.waitForTimeout(2000);
}

test('手动浏览后台所有页面', async ({ page }) => {
  console.log('🔑 JWT Token 已生成');
  console.log(`   Access Token: ${tokens.at.substring(0, 50)}...`);

  // 1. 访问登录页并注入 token
  console.log('\n📍 Step 1: 注入认证信息到 localStorage');
  await page.goto('http://localhost:8000/login');
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1000);

  await page.evaluate((t: { at: string; rt: string }) => {
    localStorage.setItem('PROBE-X-access_token', JSON.stringify(t.at));
    localStorage.setItem('PROBE-X-refresh_token', JSON.stringify(t.rt));
    localStorage.setItem('PROBE-X-userInfo', JSON.stringify({
      userId: 1,
      username: 'admin',
      email: 'admin',
      nickname: '管理员',
      isActive: true,
    }));
    console.log('✅ Token 已注入 localStorage');
  }, tokens);

  // 2. 访问首页
  console.log('\n📍 Step 2: 访问首页数据看板');
  await page.goto('http://localhost:8000/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.ant-menu', { timeout: 15000 });
  await page.waitForTimeout(3000);

  let bodyText = await page.textContent('body');
  console.log(`   页面内容长度: ${bodyText?.length} 字符`);
  console.log(`   页面前100字: "${bodyText?.substring(0, 100).replace(/\s+/g, ' ')}"`);

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-home-dashboard.png'), fullPage: true });
  console.log('   📸 截图已保存: 01-home-dashboard.png');

  // 3. 遍历所有主要页面
  const pages = [
    { path: '/point-manage/event', label: '事件管理', file: '02-event-manage' },
    { path: '/point-manage/property', label: '属性管理', file: '03-property-manage' },
    { path: '/point-manage/spm', label: 'SPM管理', file: '04-spm-manage' },
    { path: '/point-manage/scm', label: 'SCM管理', file: '05-scm-manage' },
    { path: '/data-analysis/event', label: '事件分析', file: '06-event-analysis' },
    { path: '/data-analysis/funnel', label: '漏斗分析', file: '07-funnel-analysis' },
    { path: '/data-analysis/userPath', label: '用户路径分析', file: '08-user-path' },
    { path: '/data-analysis/attribution', label: '归因分析', file: '09-attribution' },
    { path: '/system-data/overview', label: '系统数据总览', file: '10-system-overview' },
    { path: '/system-data/meta', label: '元数据管理', file: '11-meta-data' },
    { path: '/system-config/user', label: '用户管理', file: '12-user-manage' },
    { path: '/system-config/role', label: '角色管理', file: '13-role-manage' },
    { path: '/account', label: '个人中心', file: '14-account' },
  ];

  console.log('\n📍 Step 3: 遍历所有后台页面');
  let successCount = 0;

  for (const p of pages) {
    console.log(`\n   🎬 导航到: ${p.label} (${p.path})`);

    await navigateClient(page, p.path);

    const url = page.url();
    bodyText = await page.textContent('body');
    const bodyLen = bodyText?.length || 0;

    console.log(`      URL: ${url}`);
    console.log(`      内容长度: ${bodyLen} 字符`);
    console.log(`      内容预览: "${bodyText?.substring(0, 80).replace(/\s+/g, ' ')}"`);

    // 验证不是登录页
    if (url.includes('/login')) {
      console.log(`      ❌ 错误: 被重定向到登录页!`);
      throw new Error(`页面 ${p.label} 被重定向到登录页`);
    }

    if (bodyLen < 50) {
      console.log(`      ❌ 错误: 页面内容过短!`);
      throw new Error(`页面 ${p.label} 内容过短 (${bodyLen} 字符)`);
    }

    // 截图
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${p.file}.png`), fullPage: true });
    const fileSize = fs.statSync(path.join(SCREENSHOT_DIR, `${p.file}.png`)).size;
    console.log(`      📸 截图已保存: ${p.file}.png (${(fileSize / 1024).toFixed(1)} KB)`);

    successCount++;
  }

  console.log(`\n✅ 成功浏览 ${successCount}/${pages.length} 个页面`);
  console.log(`\n📂 所有截图保存在: ${path.resolve(SCREENSHOT_DIR)}`);
  console.log('\n🎉 后台浏览完成!');
});
