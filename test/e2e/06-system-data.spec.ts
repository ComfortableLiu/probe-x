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
  { path: '/system-data/overview', name: 'overview', label: '总览' },
  { path: '/system-data/analysis', name: 'analysis', label: '数分数据' },
  { path: '/system-data/meta', name: 'meta', label: '元数据' },
  {
    path: '/system-data/computingNode',
    name: 'computing-node',
    label: '计算节点',
  },
];

test.describe('06 系统数据模块测试', () => {
  test.beforeEach(async ({ page }) => {
    await bypassLogin(page);
  });

  for (const subPage of subPages) {
    test(`06 ${subPage.label} (${subPage.path}) 应正确渲染`, async ({
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

      await takeScreenshot(page, `06-system-data-${subPage.name}`);
      expect(filterApiErrors(errors)).toEqual([]);
    });
  }
});
