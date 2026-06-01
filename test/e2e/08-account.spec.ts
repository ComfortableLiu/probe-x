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

test.describe('08 个人中心测试', () => {
  test('08-01 个人中心页面应正确渲染', async ({ page }) => {
    const errors = collectErrors(page);
    await bypassLogin(page);
    await navigateTo(page, '/account');

    // 页面应有内容
    const bodyText = await page.textContent('body');
    expect(bodyText).toBeTruthy();
    expect(bodyText!.length).toBeGreaterThan(0);

    // 不应白屏
    const errorPage = page.locator(
      'text=Something went wrong, text=Application error'
    );
    const hasError = await errorPage.count().catch(() => 0);
    expect(hasError).toBe(0);

    await takeScreenshot(page, '08-account-center');
    expect(filterApiErrors(errors)).toEqual([]);
  });
});
