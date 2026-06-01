import { test, expect } from '@playwright/test';
import {
  bypassLogin,
  navigateTo,
  takeScreenshot,
  collectErrors,
} from '../utils/test-helpers';
import { SIDEBAR_MODULES } from '../fixtures/test-data';

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

test.describe('02 导航和菜单测试', () => {
  test.beforeEach(async ({ page }) => {
    await bypassLogin(page);
    await navigateTo(page, '/');
    await page.waitForTimeout(3000);
  });

  test('02-01 首页应渲染并包含基本布局元素', async ({ page }) => {
    const errors = collectErrors(page);

    // 页面不应白屏
    const bodyText = await page.textContent('body');
    expect(bodyText).toBeTruthy();
    expect(bodyText!.length).toBeGreaterThan(0);

    // 检查是否有 app 容器（自定义 class）
    const appContainer = page.locator('[class*="app"], [class*="main"], [id="app"]').first();
    await expect(appContainer).toBeVisible({ timeout: 10000 });

    await takeScreenshot(page, '02-homepage-layout');
    expect(filterApiErrors(errors)).toEqual([]);
  });

  test('02-02 通过 URL 直接导航到各模块页面', async ({ page }) => {
    const errors = collectErrors(page);

    // 测试通过直接 URL 导航到各模块
    const paths = [
      '/point-manage/event',
      '/point-manage/spm',
      '/data-analysis/event',
      '/data-analysis/funnel',
      '/system-data/overview',
      '/system-config/user',
      '/system-config/role',
    ];

    for (const path of paths) {
      await navigateTo(page, path);
      const bodyText = await page.textContent('body');
      expect(bodyText).toBeTruthy();
      expect(bodyText!.length).toBeGreaterThan(0);
      // 不应出现崩溃
      const crash = page.locator('text=Something went wrong, text=Application error');
      const hasCrash = await crash.count().catch(() => 0);
      expect(hasCrash).toBe(0);
    }

    await takeScreenshot(page, '02-nav-url-direct');
    expect(filterApiErrors(errors)).toEqual([]);
  });

  test('02-03 所有主要路径都能加载无崩溃', async ({ page }) => {
    const errors = collectErrors(page);

    const paths = [
      '/',
      '/point-manage/event',
      '/data-analysis/event',
      '/system-data/overview',
      '/system-config/user',
      '/account',
    ];

    for (const path of paths) {
      await navigateTo(page, path);
      const bodyText = await page.textContent('body');
      expect(bodyText).toBeTruthy();
      expect(bodyText!.length).toBeGreaterThan(0);

      await takeScreenshot(
        page,
        `02-path-${path.replace(/\//g, '_').replace(/^_/, '') || 'home'}`
      );
    }

    expect(filterApiErrors(errors)).toEqual([]);
  });
});
