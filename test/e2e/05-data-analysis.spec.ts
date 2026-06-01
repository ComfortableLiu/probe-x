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
  { path: '/data-analysis/event', name: 'event', label: '事件分析' },
  { path: '/data-analysis/funnel', name: 'funnel', label: '漏斗分析' },
  { path: '/data-analysis/free', name: 'free', label: '自由分析' },
  {
    path: '/data-analysis/userPath',
    name: 'user-path',
    label: '用户路径分析',
  },
  {
    path: '/data-analysis/attribution',
    name: 'attribution',
    label: '归因分析',
  },
  {
    path: '/data-analysis/dashboardConfig',
    name: 'dashboard-config',
    label: '看板设置',
  },
];

test.describe('05 数据分析模块测试', () => {
  test.beforeEach(async ({ page }) => {
    await bypassLogin(page);
  });

  for (const subPage of subPages) {
    test(`05 ${subPage.label} (${subPage.path}) 应正确渲染`, async ({
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

      await takeScreenshot(page, `05-data-analysis-${subPage.name}`);
      expect(filterApiErrors(errors)).toEqual([]);
    });
  }
});
