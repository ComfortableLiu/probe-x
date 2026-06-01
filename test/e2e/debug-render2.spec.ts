import { test } from '@playwright/test';
import { execSync } from 'child_process';

test.setTimeout(60000);

function generateTokens() {
  const result = execSync(
    `NODE_PATH=/Users/xiaoyao/.workbuddy/binaries/node/workspace/node_modules /Users/xiaoyao/.workbuddy/binaries/node/versions/22.22.2/bin/node -e "
const jwt = require('jsonwebtoken');
const SECRET = 'r4r99sQjYGj5srofcVe6CHZXeI4hKMCp1kZDNjTOiCNTRdBhWXzuK4JSiHyFD9I4';
const ts = Date.now();
const at = jwt.sign({ userId: 1, username: 'admin', tokenType: 'access', clientId: 'probe-x', jti: 'dbg2-' + ts }, SECRET, { expiresIn: '24h' });
const rt = jwt.sign({ userId: 1, username: 'admin', tokenType: 'refresh', clientId: 'probe-x', jti: 'dbg2-r-' + ts }, SECRET, { expiresIn: '7d' });
console.log(JSON.stringify({ at, rt }));
"`,
    { encoding: 'utf8' }
  ).trim();
  return JSON.parse(result);
}

test('深度诊断前端渲染', async ({ page }) => {
  const logs: string[] = [];
  page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text().substring(0, 200)}`));
  page.on('pageerror', (err) => logs.push(`[PAGE_ERROR] ${err.message}`));
  page.on('requestfailed', (req) => logs.push(`[NET_FAIL] ${req.method()} ${req.url()} -> ${req.failure()?.errorText}`));

  const apiResponses: string[] = [];
  page.on('response', (resp) => {
    if (resp.url().includes('/api/')) {
      apiResponses.push(`${resp.status()} ${resp.request().method()} ${resp.url()}`);
    }
  });

  const tokens = generateTokens();
  console.log(`\n🔑 Token: ${tokens.at.substring(0, 30)}...`);

  // 1. 去登录页注入 token
  await page.goto('http://localhost:8000/login');
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(2000);

  await page.evaluate((t: { at: string; rt: string }) => {
    localStorage.setItem('PROBE-X-access_token', JSON.stringify(t.at));
    localStorage.setItem('PROBE-X-refresh_token', JSON.stringify(t.rt));
    localStorage.setItem('PROBE-X-userInfo', JSON.stringify({
      userId: 1, username: 'admin', email: 'admin', nickname: '管理员', isActive: true,
    }));
    console.log('Token injected:', localStorage.getItem('PROBE-X-access_token')?.substring(0, 30));
  }, tokens);

  // 验证 token 已写入
  const storedToken = await page.evaluate(() => localStorage.getItem('PROBE-X-access_token'));
  console.log(`  Stored token: ${storedToken?.substring(0, 40)}...`);

  // 2. 导航到首页（不跳转，直接 goto）
  console.log('\n📍 Navigating to /');
  await page.goto('http://localhost:8000/');
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(8000);

  const url = page.url();
  console.log(`  URL: ${url}`);

  // 检查 token 是否还在
  const tokenAfterNav = await page.evaluate(() => localStorage.getItem('PROBE-X-access_token'));
  console.log(`  Token after nav: ${tokenAfterNav?.substring(0, 40) || 'MISSING!'}`);

  const bodyText = await page.textContent('body');
  console.log(`  Body length: ${bodyText?.length}`);
  console.log(`  Body text: "${bodyText?.substring(0, 500)}"`);

  // 检查 #app 内容
  const appHtml = await page.evaluate(() => document.getElementById('app')?.innerHTML?.substring(0, 2000) || 'NO #app');
  console.log(`\n  #app HTML (${appHtml.length}): ${appHtml.substring(0, 1000)}`);

  // 检查是否有 ant-menu（侧边栏）
  const hasMenu = await page.locator('.ant-menu').count();
  console.log(`  ant-menu count: ${hasMenu}`);

  // 检查是否有 loading spinner
  const hasSpin = await page.locator('.ant-spin').count();
  console.log(`  ant-spin count: ${hasSpin}`);

  console.log(`\n=== API Responses (${apiResponses.length}) ===`);
  apiResponses.forEach((r, i) => console.log(`  ${i + 1}. ${r}`));

  console.log(`\n=== Console logs (${logs.length}) ===`);
  logs.slice(0, 30).forEach((l, i) => console.log(`  ${i + 1}. ${l}`));

  await page.screenshot({ path: 'test/screenshots/dashboard-verify/debug-render2.png', fullPage: true });
  console.log('\n📸 debug-render2.png saved');
});
