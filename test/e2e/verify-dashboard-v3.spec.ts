import { test } from '@playwright/test';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

test.setTimeout(300000); // 5分钟

const SCREENSHOT_DIR = 'test/screenshots/dashboard-final';
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

function generateTokens() {
  const result = execSync(
    `NODE_PATH=/Users/xiaoyao/.workbuddy/binaries/node/workspace/node_modules /Users/xiaoyao/.workbuddy/binaries/node/versions/22.22.2/bin/node -e "
const jwt = require('jsonwebtoken');
const SECRET = 'r4r99sQjYGj5srofcVe6CHZXeI4hKMCp1kZDNjTOiCNTRdBhWXzuK4JSiHyFD9I4';
const ts = Date.now();
const at = jwt.sign({ userId: 1, username: 'admin', tokenType: 'access', clientId: 'probe-x', jti: 'v4-' + ts }, SECRET, { expiresIn: '24h' });
const rt = jwt.sign({ userId: 1, username: 'admin', tokenType: 'refresh', clientId: 'probe-x', jti: 'v4-r-' + ts }, SECRET, { expiresIn: '7d' });
console.log(JSON.stringify({ at, rt }));
"`,
    { encoding: 'utf8' }
  ).trim();
  return JSON.parse(result);
}

const tokens = generateTokens();

async function navigateClient(page: any, targetPath: string) {
  await page.evaluate((p: string) => {
    window.history.pushState({}, '', p);
    window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
  }, targetPath);
  await page.waitForTimeout(1500);
}

test('完整后台验证', async ({ page }) => {
  console.log(`🔑 JWT Token ready`);

  // 注入 token
  await page.goto('http://localhost:8000/login');
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(500);
  await page.evaluate((t: { at: string; rt: string }) => {
    localStorage.setItem('PROBE-X-access_token', JSON.stringify(t.at));
    localStorage.setItem('PROBE-X-refresh_token', JSON.stringify(t.rt));
    localStorage.setItem('PROBE-X-userInfo', JSON.stringify({
      userId: 1, username: 'admin', email: 'admin', nickname: '管理员', isActive: true,
    }));
  }, tokens);

  // 加载首页
  await page.goto('http://localhost:8000/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.ant-menu', { timeout: 15000 });
  await page.waitForTimeout(2000);

  const pages = [
    { path: '/', label: '首页', file: '01-home' },
    { path: '/point-manage/event', label: '事件管理', file: '02-event' },
    { path: '/point-manage/property', label: '属性管理', file: '03-property' },
    { path: '/point-manage/spm', label: 'SPM管理', file: '04-spm' },
    { path: '/point-manage/scm', label: 'SCM管理', file: '05-scm' },
    { path: '/data-analysis/event', label: '事件分析', file: '06-event-analysis' },
    { path: '/data-analysis/funnel', label: '漏斗分析', file: '07-funnel' },
    { path: '/data-analysis/userPath', label: '用户路径', file: '08-user-path' },
    { path: '/data-analysis/attribution', label: '归因分析', file: '09-attribution' },
    { path: '/system-data/overview', label: '系统总览', file: '10-system-overview' },
    { path: '/system-data/meta', label: '元数据', file: '11-meta' },
    { path: '/system-config/user', label: '用户管理', file: '12-user' },
    { path: '/system-config/role', label: '角色管理', file: '13-role' },
    { path: '/account', label: '个人中心', file: '14-account' },
  ];

  let passed = 0;
  for (const p of pages) {
    if (p.path !== '/') {
      await navigateClient(page, p.path);
    }

    const url = page.url();
    const bodyText = await page.textContent('body');
    const bodyLen = bodyText?.length || 0;

    // 检查不是登录页
    if (url.includes('/login')) throw new Error(`❌ ${p.label}: 跳到登录页!`);
    if (bodyLen < 50) throw new Error(`❌ ${p.label}: 页面内容太短(${bodyLen})`);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${p.file}.png`), fullPage: true });
    const size = fs.statSync(path.join(SCREENSHOT_DIR, `${p.file}.png`)).size;
    console.log(`  ✅ ${p.label}: bodyLen=${bodyLen}, 📸 ${(size / 1024).toFixed(0)}KB`);
    passed++;
  }

  console.log(`\n🎉 ${passed}/${pages.length} 页面全部验证通过!`);
});
