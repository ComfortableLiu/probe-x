import { Page, expect } from '@playwright/test';

/**
 * Mock all API responses so the frontend can render without a real backend.
 * Uses broad URL patterns to ensure nothing slips through to the real server.
 */
export async function mockApiResponses(page: Page) {
  const mockBody = (data: any) => ({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ code: 200, data, message: 'success' }),
  });

  // Intercept ALL requests — filter inside handler
  await page.route('**/*', async (route) => {
    const url = route.request().url();
    // Only mock API requests, let static assets through
    if (!url.includes('/api/') && !url.includes(':8101')) {
      return route.continue();
    }

    // User profile
    if (url.includes('/user/profile') && !url.includes('update')) {
      return route.fulfill(
        mockBody({
          id: 1,
          username: 'admin',
          nickname: '管理员',
          email: 'admin@probe-x.dev',
          avatar: '',
          role: 'super_admin',
          permissions: ['*'],
          roleList: [{ id: 1, name: '超管', key: 'super_admin' }],
        })
      );
    }

    // Role permission list
    if (url.includes('/user/rolePermissionList')) {
      return route.fulfill(
        mockBody([
          { id: 1, name: '首页', key: 'homepage', children: [] },
          {
            id: 2,
            name: '埋点管理',
            key: 'point-manage',
            children: [
              { id: 21, name: '事件管理', key: 'point-manage:event' },
              { id: 22, name: '属性管理', key: 'point-manage:property' },
              { id: 23, name: 'SPM管理', key: 'point-manage:spm' },
              { id: 24, name: 'SCM管理', key: 'point-manage:scm' },
              { id: 25, name: '基础编码管理', key: 'point-manage:basic-coding' },
            ],
          },
          {
            id: 3,
            name: '数据分析',
            key: 'data-analysis',
            children: [
              { id: 31, name: '事件分析', key: 'data-analysis:event' },
              { id: 32, name: '漏斗分析', key: 'data-analysis:funnel' },
              { id: 33, name: '自由分析', key: 'data-analysis:free' },
              { id: 34, name: '用户路径分析', key: 'data-analysis:userPath' },
              { id: 35, name: '归因分析', key: 'data-analysis:attribution' },
              { id: 36, name: '看板设置', key: 'data-analysis:dashboardConfig' },
            ],
          },
          {
            id: 4,
            name: '系统数据',
            key: 'system-data',
            children: [
              { id: 41, name: '总览', key: 'system-data:overview' },
              { id: 42, name: '数分数据', key: 'system-data:analysis' },
              { id: 43, name: '元数据', key: 'system-data:meta' },
              { id: 44, name: '计算节点', key: 'system-data:computingNode' },
            ],
          },
          {
            id: 5,
            name: '系统设置',
            key: 'system-config',
            children: [
              { id: 51, name: '用户管理', key: 'system-config:user' },
              { id: 52, name: '系统管理', key: 'system-config:system' },
              { id: 53, name: '计算节点配置', key: 'system-config:computing-node' },
              { id: 54, name: '角色管理', key: 'system-config:role' },
              { id: 55, name: '系统参数配置', key: 'system-config:system-params' },
              { id: 56, name: '数据源配置', key: 'system-config:datasource' },
              { id: 57, name: '通知设置', key: 'system-config:notification' },
              { id: 58, name: '日志配置', key: 'system-config:log-config' },
              { id: 59, name: '项目管理', key: 'system-config:project' },
              { id: 60, name: '审计日志', key: 'system-config:audit-log' },
              { id: 61, name: '告警管理', key: 'system-config:alert' },
            ],
          },
        ])
      );
    }

    // Refresh token
    if (url.includes('/user/refreshToken')) {
      return route.fulfill(
        mockBody({
          accessToken: 'mock-access-token',
          refreshToken: 'mock-refresh-token',
        })
      );
    }

    // Homepage endpoints
    if (url.includes('/homepage/overview')) {
      return route.fulfill(
        mockBody({
          totalEvents: 125000,
          todayEvents: 3200,
          totalUsers: 5000,
          todayUsers: 120,
          totalSessions: 18000,
          todaySessions: 450,
          avgResponseTime: 45,
          systemAvailability: 99.8,
        })
      );
    }
    if (url.includes('/homepage/trend')) {
      return route.fulfill(mockBody({ dates: [], values: [] }));
    }
    if (url.includes('/homepage/realtime-events')) {
      return route.fulfill(mockBody({ list: [], total: 0 }));
    }

    // Dashboard list
    if (url.includes('/dashboard/list') || url.includes('/dashboard/detail')) {
      return route.fulfill(mockBody({ list: [], total: 0 }));
    }

    // All list/simple endpoints
    if (
      url.includes('/list') ||
      url.includes('/simple') ||
      url.includes('/commonList')
    ) {
      return route.fulfill(mockBody({ list: [], total: 0, items: [] }));
    }

    // Default: success with empty data
    return route.fulfill(mockBody({}));
  });
}

/**
 * Bypass login by injecting auth tokens and setting up API mocks.
 * The app uses Localstorage.get() which does JSON.parse(),
 * so we must store values as JSON.stringify'd strings.
 */
export async function bypassLogin(page: Page, token = 'e2e-test-token') {
  // Set up API mocking BEFORE any navigation
  await mockApiResponses(page);

  await page.goto('/login');
  await page.evaluate((t) => {
    localStorage.setItem('PROBE-X-access_token', JSON.stringify(t));
    localStorage.setItem(
      'PROBE-X-refresh_token',
      JSON.stringify('e2e-test-refresh-token')
    );
    localStorage.setItem(
      'PROBE-X-userInfo',
      JSON.stringify({
        id: 1,
        username: 'admin',
        nickname: '管理员',
        email: 'admin@probe-x.dev',
        role: 'super_admin',
        permissions: ['*'],
      })
    );
  }, token);
}

/**
 * Navigate to a page and wait for the main content to load.
 */
export async function navigateTo(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1000);
}

/**
 * Take a screenshot and save to test/screenshots/.
 */
export async function takeScreenshot(page: Page, name: string) {
  const sanitized = name.replace(/[^a-zA-Z0-9_-]/g, '_');
  await page.screenshot({
    path: `test/screenshots/${sanitized}.png`,
    fullPage: true,
  });
}

export async function waitForTable(page: Page) {
  await page.waitForSelector('.ant-table', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(500);
}

export async function waitForLoadingDone(page: Page) {
  await page
    .waitForSelector('.ant-spin-spinning', { state: 'hidden', timeout: 15000 })
    .catch(() => {});
}

export async function clickMenuItem(page: Page, text: string) {
  const menuItem = page
    .locator('.ant-menu-item, .ant-menu-submenu-title')
    .filter({ hasText: text });
  await menuItem.first().click();
  await page.waitForTimeout(500);
}

export async function clickSubMenuItem(
  page: Page,
  parentText: string,
  childText: string
) {
  const submenuTitle = page
    .locator('.ant-menu-submenu-title')
    .filter({ hasText: parentText });
  await submenuTitle.click();
  await page.waitForTimeout(300);
  const childItem = page
    .locator('.ant-menu-item')
    .filter({ hasText: childText });
  await childItem.first().click();
  await page.waitForTimeout(500);
}

export async function expectLoginRedirect(page: Page) {
  await expect(page).toHaveURL(/\/login/);
}

export function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(`PageError: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(`ConsoleError: ${msg.text()}`);
    }
  });
  return errors;
}

export function filterApiErrors(errors: string[]): string[] {
  return errors.filter(
    (e) =>
      !e.includes('Failed to fetch') &&
      !e.includes('NetworkError') &&
      !e.includes('net::ERR') &&
      !e.includes('404') &&
      !e.includes('502') &&
      !e.includes('503') &&
      !e.includes('ERR_CONNECTION_REFUSED')
  );
}
