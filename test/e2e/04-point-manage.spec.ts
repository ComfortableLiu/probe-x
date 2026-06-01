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
  { path: '/point-manage/event', name: 'event', label: '事件管理' },
  { path: '/point-manage/property', name: 'property', label: '属性管理' },
  { path: '/point-manage/spm', name: 'spm', label: 'SPM管理' },
  { path: '/point-manage/scm', name: 'scm', label: 'SCM管理' },
  {
    path: '/point-manage/basic-coding',
    name: 'basic-coding',
    label: '基础编码管理',
  },
];

test.describe('04 埋点管理模块测试', () => {
  test.beforeEach(async ({ page }) => {
    await bypassLogin(page);
  });

  for (const subPage of subPages) {
    test(`04 ${subPage.label} (${subPage.path}) 应正确渲染`, async ({
      page,
    }) => {
      const errors = collectErrors(page);
      await navigateTo(page, subPage.path);

      // 页面不应白屏
      const bodyText = await page.textContent('body');
      expect(bodyText).toBeTruthy();
      expect(bodyText!.length).toBeGreaterThan(0);

      // 不应出现崩溃错误页
      const errorPage = page.locator(
        'text=Something went wrong, text=Application error'
      );
      const hasError = await errorPage.count().catch(() => 0);
      expect(hasError).toBe(0);

      await takeScreenshot(page, `04-point-manage-${subPage.name}`);
      expect(filterApiErrors(errors)).toEqual([]);
    });
  }
});
