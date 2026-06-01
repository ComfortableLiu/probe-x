import { test } from '@playwright/test';
import { execSync } from 'child_process';

test.setTimeout(30000);

function generateTokens() {
  const result = execSync(
    `NODE_PATH=/Users/xiaoyao/.workbuddy/binaries/node/workspace/node_modules /Users/xiaoyao/.workbuddy/binaries/node/versions/22.22.2/bin/node -e "
const jwt = require('jsonwebtoken');
const SECRET = 'r4r99sQjYGj5srofcVe6CHZXeI4hKMCp1kZDNjTOiCNTRdBhWXzuK4JSiHyFD9I4';
const ts = Date.now();
const at = jwt.sign({ userId: 1, username: 'admin', tokenType: 'access', clientId: 'probe-x', jti: 'dbg-' + ts }, SECRET, { expiresIn: '24h' });
const rt = jwt.sign({ userId: 1, username: 'admin', tokenType: 'refresh', clientId: 'probe-x', jti: 'dbg-r-' + ts }, SECRET, { expiresIn: '7d' });
console.log(JSON.stringify({ at, rt }));
"`,
    { encoding: 'utf8' }
  ).trim();
  return JSON.parse(result);
}

test('诊断前端渲染问题', async ({ page }) => {
  const consoleErrors: string[] = [];
  const networkFailures: string[] = [];
  const apiResponses: string[] = [];

  // 监听 console
  page.on('console', (msg) => {
    const type = msg.type();
    const text = msg.text();
    if (type === 'error') {
      consoleErrors.push(text);
    }
    console.log(`[CONSOLE ${type}] ${text.substring(0, 300)}`);
  });

  // 监听 JS 错误
  page.on('pageerror', (err) => {
    consoleErrors.push(`PAGE_ERROR: ${err.message}`);
    console.log(`[PAGE_ERROR] ${err.message}`);
  });

  // 监听网络请求失败
  page.on('requestfailed', (req) => {
    const msg = `${req.method()} ${req.url()} -> ${req.failure()?.errorText}`;
    networkFailures.push(msg);
    console.log(`[NET_FAIL] ${msg}`);
  });

  // 监听 API 响应
  page.on('response', (resp) => {
    if (resp.url().includes('/api/')) {
      const msg = `${resp.status()} ${resp.request().method()} ${resp.url()}`;
      apiResponses.push(msg);
      console.log(`[API] ${msg}`);
    }
  });

  // 1. 注入 token
  const tokens = generateTokens();
  console.log(`\n🔑 Token: ${tokens.at.substring(0, 30)}...`);

  await page.goto('http://localhost:8000/login');
  await page.waitForLoadState('networkidle').catch(() => {});

  await page.evaluate((t: { at: string; rt: string }) => {
    localStorage.setItem('PROBE-X-access_token', JSON.stringify(t.at));
    localStorage.setItem('PROBE-X-refresh_token', JSON.stringify(t.rt));
    localStorage.setItem('PROBE-X-userInfo', JSON.stringify({
      userId: 1, username: 'admin', email: 'admin', nickname: '管理员', isActive: true,
    }));
  }, tokens);

  // 2. 导航到首页
  console.log('\n📍 Navigating to /');
  await page.goto('http://localhost:8000/');
  await page.waitForTimeout(8000);

  // 3. 诊断结果
  const url = page.url();
  const bodyText = await page.textContent('body');
  const html = await page.content();

  console.log('\n========== 诊断结果 ==========');
  console.log(`URL: ${url}`);
  console.log(`bodyLen: ${bodyText?.length}`);
  console.log(`bodyText: "${bodyText?.substring(0, 500)}"`);
  console.log(`htmlLen: ${html.length}`);
  console.log(`\nConsole errors (${consoleErrors.length}):`);
  consoleErrors.forEach((e, i) => console.log(`  ${i + 1}. ${e.substring(0, 300)}`));
  console.log(`\nNetwork failures (${networkFailures.length}):`);
  networkFailures.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
  console.log(`\nAPI responses (${apiResponses.length}):`);
  apiResponses.forEach((r, i) => console.log(`  ${i + 1}. ${r}`));

  // 检查 React 挂载点
  const appContent = await page.evaluate(() => {
    const app = document.getElementById('app');
    return app ? app.innerHTML.substring(0, 2000) : 'NO #app ELEMENT';
  });
  console.log(`\n#app innerHTML (${appContent.length}): ${appContent.substring(0, 1000)}`);

  await page.screenshot({ path: 'test/screenshots/dashboard-verify/debug-render.png', fullPage: true });
  console.log('\n📸 debug-render.png saved');
});
