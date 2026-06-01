import { test, expect, Page } from '@playwright/test';
import { execSync } from 'child_process';

const SCREENSHOT_DIR = 'test/screenshots/dashboard-verify';

test.setTimeout(90000);

/**
 * 直接用 Node.js + JWT_SECRET 生成 token，注入 localStorage
 * 完全不调 login API，避免限流问题
 */
function generateTokens(): { accessToken: string; refreshToken: string } {
  const result = execSync(
    `NODE_PATH=/Users/xiaoyao/.workbuddy/binaries/node/workspace/node_modules /Users/xiaoyao/.workbuddy/binaries/node/versions/22.22.2/bin/node -e "
const jwt = require('jsonwebtoken');
const SECRET = 'r4r99sQjYGj5srofcVe6CHZXeI4hKMCp1kZDNjTOiCNTRdBhWXzuK4JSiHyFD9I4';
const ts = Date.now();
const accessToken = jwt.sign({ userId: 1, username: 'admin', tokenType: 'access', clientId: 'probe-x', jti: 'e2e-a-' + ts }, SECRET, { expiresIn: '24h' });
const refreshToken = jwt.sign({ userId: 1, username: 'admin', tokenType: 'refresh', clientId: 'probe-x', jti: 'e2e-r-' + ts }, SECRET, { expiresIn: '7d' });
console.log(JSON.stringify({ accessToken, refreshToken }));
"`,
    { encoding: 'utf8' }
  ).trim();
  return JSON.parse(result);
}

// 在模块加载时预生成 token（只调一次）
let cachedTokens: { accessToken: string; refreshToken: string } | null = null;
function getTokens() {
  if (!cachedTokens) {
    cachedTokens = generateTokens();
    console.log(`  🔑 Generated JWT tokens (access: ${cachedTokens.accessToken.substring(0, 20)}...)`);
  }
  return cachedTokens;
}

/**
 * 注入 token 到 localStorage 实现免登录
 */
async function injectAuth(page: Page) {
  const tokens = getTokens();

  // 先去登录页获取 JS 运行环境
  await page.goto('http://localhost:8000/login');
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1000);

  // 注入 token（JSON.stringify 包装，匹配前端 Localstorage.get() 的 JSON.parse）
  await page.evaluate((t: { accessToken: string; refreshToken: string }) => {
    localStorage.setItem('PROBE-X-access_token', JSON.stringify(t.accessToken));
    localStorage.setItem('PROBE-X-refresh_token', JSON.stringify(t.refreshToken));
    localStorage.setItem(
      'PROBE-X-userInfo',
      JSON.stringify({
        userId: 1,
        username: 'admin',
        email: 'admin',
        nickname: '管理员',
        isActive: true,
      })
    );
  }, tokens);
}

/**
 * 验证当前页面不是登录页（强断言）
 */
async function assertNotLoginPage(page: Page, pageLabel: string) {
  const url = page.url();

  // 断言1：URL 不应该包含 /login
  if (url.includes('/login')) {
    throw new Error(`❌ ${pageLabel}: 页面重定向到了登录页! URL=${url}`);
  }

  // 断言2：页面不应该包含登录表单元素
  const hasLoginForm = await page.locator('#normal_login_username, input[name="username"]').count();
  if (hasLoginForm > 0) {
    throw new Error(`❌ ${pageLabel}: 页面包含登录表单! URL=${url}`);
  }

  // 断言3：页面应该有实质内容（>100字符）
  const bodyText = await page.textContent('body');
  expect(bodyText).toBeTruthy();
  expect(bodyText!.length).toBeGreaterThan(100);

  console.log(`  ✅ ${pageLabel}: URL=${url}, bodyLen=${bodyText!.length}`);
}

test.describe('Probe-X 后台真实验证', () => {
  const pages = [
    { path: '/', label: '首页数据看板', file: 'dash-01-home' },
    { path: '/point-manage/event', label: '事件管理', file: 'dash-02-event' },
    { path: '/point-manage/property', label: '属性管理', file: 'dash-03-property' },
    { path: '/point-manage/spm', label: 'SPM管理', file: 'dash-04-spm' },
    { path: '/point-manage/scm', label: 'SCM管理', file: 'dash-05-scm' },
    { path: '/data-analysis/event', label: '事件分析', file: 'dash-06-event-analysis' },
    { path: '/data-analysis/funnel', label: '漏斗分析', file: 'dash-07-funnel' },
    { path: '/data-analysis/userPath', label: '用户路径分析', file: 'dash-08-user-path' },
    { path: '/data-analysis/attribution', label: '归因分析', file: 'dash-09-attribution' },
    { path: '/system-data/overview', label: '系统数据总览', file: 'dash-10-system-overview' },
    { path: '/system-data/meta', label: '元数据', file: 'dash-11-meta' },
    { path: '/system-config/user', label: '用户管理', file: 'dash-12-user' },
    { path: '/system-config/role', label: '角色管理', file: 'dash-13-role' },
    { path: '/account', label: '个人中心', file: 'dash-14-account' },
  ];

  for (const p of pages) {
    test(`${p.label} (${p.path})`, async ({ page }) => {
      console.log(`\n🎬 验证 ${p.label}`);

      // 1. 注入 JWT token（不调 login API）
      await injectAuth(page);

      // 2. 导航到目标页面，等 React Router + lazy 组件加载完成
      await page.goto(`http://localhost:8000${p.path}`, { waitUntil: 'networkidle' });

      // 等待侧边栏菜单渲染（证明页面框架已加载，说明已通过登录验证）
      await page.waitForSelector('.ant-menu', { timeout: 20000 }).catch(() => {});
      // 等待内容区域渲染（排除 loading 状态）—— 等待 ant-spin 消失
      await page.waitForSelector('.ant-spin-spinning', { state: 'hidden', timeout: 20000 }).catch(() => {});
      // 额外等待确保 React lazy 组件和数据加载完成
      await page.waitForTimeout(5000);

      // 3. 强断言：不是登录页
      await assertNotLoginPage(page, p.label);

      // 4. 截图
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/${p.file}.png`,
        fullPage: true,
      });
      console.log(`  📸 ${p.file}.png saved`);
    });
  }
});
