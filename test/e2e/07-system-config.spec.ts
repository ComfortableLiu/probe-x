import { test, expect } from '@playwright/test';
import {
  bypassLogin,
  navigateTo,
  takeScreenshot,
  collectErrors,
} from '../utils/test-helpers';

const filterApiErrors = (errors: string[]) =>
  errors.filter(
    (e) =>
      !e.includes('Failed to fetch') &&
      !e.includes('NetworkError') &&
      !e.includes('net::ERR') &&
      !e.includes('404') &&
      !e.includes('502') &&
      !e.includes('503') &&
      !e.includes('ERR_CONNECTION_REFUSED')
  );

const subPages = [
  { path: '/system-config/user', name: 'user', label: '用户管理' },
  { path: '/system-config/system', name: 'system', label: '系统管理' },
  {
    path: '/system-config/computing-node',
    name: 'computing-node',
    label: '计算节点配置',
  },
  { path: '/system-config/role', name: 'role', label: '角色管理' },
  {
    path: '/system-config/system-params',
    name: 'system-params',
    label: '系统参数配置',
  },
  {
    path: '/system-config/datasource',
    name: 'datasource',
    label: '数据源配置',
  },
  {
    path: '/system-config/notification',
    name: 'notification',
    label: '通知设置',
  },
  {
    path: '/system-config/log-config',
    name: 'log-config',
    label: '日志配置',
  },
  { path: '/system-config/project', name: 'project', label: '项目管理' },
  {
    path: '/system-config/audit-log',
    name: 'audit-log',
    label: '审计日志',
  },
  { path: '/system-config/alert', name: 'alert', label: '告警管理' },
];

test.describe('07 系统设置模块测试', () => {
  test.beforeEach(async ({ page }) => {
    await bypassLogin(page);
  });

  for (const subPage of subPages) {
    test(`07 ${subPage.label} (${subPage.path}) 应正确渲染`, async ({
      page,
    }) => {
      const errors = collectErrors(page);
      await navigateTo(page, subPage.path);

      const bodyText = await page.textContent('body');
      expect(bodyText).toBeTruthy();
      expect(bodyText!.length).toBeGreaterThan(0);

      const errorPage = page.locator(
        'text=Something went wrong, text=Application error'
      );
      const hasError = await errorPage.count().catch(() => 0);
      expect(hasError).toBe(0);

      await takeScreenshot(page, `07-system-config-${subPage.name}`);
      expect(filterApiErrors(errors)).toEqual([]);
    });
  }
});
