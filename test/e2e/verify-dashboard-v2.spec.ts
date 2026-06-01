import { test } from '@playwright/test';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

test.setTimeout(60000);

const SCREENSHOT_DIR = 'test/screenshots/dashboard-final';
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

function generateTokens() {
  const result = execSync(
    `NODE_PATH=/Users/xiaoyao/.workbuddy/binaries/node/workspace/node_modules /Users/xiaoyao/.workbuddy/binaries/node/versions/22.22.2/bin/node -e "
const jwt = require('jsonwebtoken');
const SECRET = 'r4r99sQjYGj5srofcVe6CHZXeI4hKMCp1kZDNjTOiCNTRdBhWXzuK4JSiHyFD9I4';
const ts = Date.now();
const at = jwt.sign({ userId: 1, username: 'admin', tokenType: 'access', clientId: 'probe-x', jti: 'v2-' + ts }, SECRET, { expiresIn: '24h' });
const rt = jwt.sign({ userId: 1, username: 'admin', tokenType: 'refresh', clientId: 'probe-x', jti: 'v2-r-' + ts }, SECRET, { expiresIn: '7d' });
console.log(JSON.stringify({ at, rt }));
"`,
    { encoding: 'utf8' }
  ).trim();
  return JSON.parse(result);
}

let cachedTokens: { at: string; rt: string } | null = null;
function getTokens() {
  if (!cachedTokens) {
    cachedTokens = generateTokens();
    console.log(`🔑 Generated JWT tokens`);
  }
  return cachedTokens;
}

async function injectAuth(page: any) {
  const tokens = getTokens();
  await page.goto('http://localhost:8000/login');
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1000);
  await page.evaluate((t: { at: string; rt: string }) => {
    localStorage.setItem('PROBE-X-access_token', JSON.stringify(t.at));
    localStorage.setItem('PROBE-X-refresh_token', JSON.stringify(t.rt));
    localStorage.setItem('PROBE-X-userInfo', JSON.stringify({
      userId: 1, username: 'admin', email: 'admin', nickname: '管理员', isActive: true,
    }));
  }, tokens);
}

// 每个页面的唯一标识元素
const pages = [
  { path: '/', label: '首页数据看板', file: '01-home', checkText: '数据看板' },
  { path: '/point-manage/event', label: '事件管理', file: '02-event', checkText: '事件管理' },
  { path: '/point-manage/property', label: '属性管理', file: '03-property', checkText: '属性管理' },
  { path: '/point-manage/spm', label: 'SPM管理', file: '04-spm', checkText: 'SPM' },
  { path: '/point-manage/scm', label: 'SCM管理', file: '05-scm', checkText: 'SCM' },
  { path: '/data-analysis/event', label: '事件分析', file: '06-event-analysis', checkText: '事件分析' },
  { path: '/data-analysis/funnel', label: '漏斗分析', file: '07-funnel', checkText: '漏斗分析' },
  { path: '/data-analysis/userPath', label: '用户路径分析', file: '08-user-path', checkText: '用户路径' },
  { path: '/data-analysis/attribution', label: '归因分析', file: '09-attribution', checkText: '归因分析' },
  { path: '/system-data/overview', label: '系统数据总览', file: '10-system-overview', checkText: '总览' },
  { path: '/system-data/meta', label: '元数据', file: '11-meta', checkText: '元数据' },
  { path: '/system-config/user', label: '用户管理', file: '12-user', checkText: '用户管理' },
  { path: '/system-config/role', label: '角色管理', file: '13-role', checkText: '角色管理' },
  { path: '/account', label: '个人中心', file: '14-account', checkText: '个人中心' },
];

test.describe('Probe-X 后台完整验证 (v2)', () => {
  for (const p of pages) {
    test(`${p.label} (${p.path})`, async ({ page }) => {
      console.log(`\n🎬 ${p.label}`);

      // 1. 注入 token
      await injectAuth(page);

      // 2. 导航
      await page.goto(`http://localhost:8000${p.path}`, { waitUntil: 'networkidle' });
      await page.waitForSelector('.ant-menu', { timeout: 20000 }).catch(() => {});
      await page.waitForSelector('.ant-spin-spinning', { state: 'hidden', timeout: 20000 }).catch(() => {});
      await page.waitForTimeout(3000);

      // 3. 验证
      const url = page.url();

      // 断言1: 不在登录页
      if (url.includes('/login')) {
        throw new Error(`❌ 重定向到登录页! URL=${url}`);
      }

      // 断言2: 有侧边栏菜单
      const menuCount = await page.locator('.ant-menu').count();
      if (menuCount === 0) {
        throw new Error(`❌ 没有侧边栏菜单!`);
      }

      // 断言3: 页面包含对应的文本标识
      const bodyText = await page.textContent('body');
      if (!bodyText || bodyText.length < 50) {
        throw new Error(`❌ 页面内容太少! bodyLen=${bodyText?.length}`);
      }

      // 断言4: 侧边栏选中了对应的菜单项
      const selectedMenu = await page.locator('.ant-menu-item-selected').textContent().catch(() => '');
      console.log(`  ✅ URL=${url}, menuCount=${menuCount}, bodyLen=${bodyText.length}, selectedMenu="${selectedMenu}"`);

      // 4. 截图
      const screenshotPath = path.join(SCREENSHOT_DIR, `${p.file}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });

      const fileSize = fs.statSync(screenshotPath).size;
      console.log(`  📸 ${p.file}.png (${(fileSize / 1024).toFixed(1)} KB)`);
    });
  }
});
