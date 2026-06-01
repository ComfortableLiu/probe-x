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

test.describe('03 首页/数据看板测试', () => {
  test.beforeEach(async ({ page }) => {
    await bypassLogin(page);
  });

  test('03-01 首页应正确渲染无崩溃', async ({ page }) => {
    const errors = collectErrors(page);
    await navigateTo(page, '/');
    await page.waitForTimeout(2000);

    // 页面应有内容（不应白屏）
    const bodyText = await page.textContent('body');
    expect(bodyText).toBeTruthy();
    expect(bodyText!.length).toBeGreaterThan(0);

    // 不应出现白屏错误
    const errorPage = page.locator(
      'text=Something went wrong, text=Application error'
    );
    const hasError = await errorPage.count().catch(() => 0);
    expect(hasError).toBe(0);

    await takeScreenshot(page, '03-homepage-rendered');
    expect(filterApiErrors(errors)).toEqual([]);
  });

  test('03-02 首页应包含基本布局结构', async ({ page }) => {
    const errors = collectErrors(page);
    await navigateTo(page, '/');
    await page.waitForTimeout(2000);

    // 检查应用容器存在
    const appContainer = page.locator('[class*="app"], [class*="main"], [id="app"]').first();
    await expect(appContainer).toBeVisible({ timeout: 10000 });

    // 检查有内容区域
    const bodyText = await page.textContent('body');
    expect(bodyText).toBeTruthy();
    expect(bodyText!.length).toBeGreaterThan(0);

    await takeScreenshot(page, '03-homepage-layout');
    expect(filterApiErrors(errors)).toEqual([]);
  });
});
