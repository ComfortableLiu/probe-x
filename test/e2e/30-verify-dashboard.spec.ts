import { test, expect } from '@playwright/test';

test.describe('Probe-X 数据分析系统验证', () => {
  test.beforeEach(async ({ page }) => {
    // 登录
    await page.goto('http://localhost:8000/login');
    await page.waitForLoadState('networkidle');

    await page.fill('#username', 'admin');
    await page.fill('#password', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard/**', { timeout: 10000 });
    await page.waitForTimeout(2000);
  });

  test('验证数据总览页面', async ({ page }) => {
    await page.goto('http://localhost:8000/dashboard/overview');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // 截图
    await page.screenshot({
      path: 'test/screenshots/dashboard-overview.png',
      fullPage: true
    });

    // 验证页面包含关键元素
    await expect(page.locator('text=数据总览')).toBeVisible();

    console.log('✅ 数据总览页面验证完成');
  });

  test('验证事件分析页面', async ({ page }) => {
    await page.goto('http://localhost:8000/dashboard/event-analysis');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // 截图
    await page.screenshot({
      path: 'test/screenshots/event-analysis.png',
      fullPage: true
    });

    // 验证页面包含关键元素
    await expect(page.locator('text=事件分析')).toBeVisible();

    console.log('✅ 事件分析页面验证完成');
  });

  test('验证漏斗分析页面', async ({ page }) => {
    await page.goto('http://localhost:8000/dashboard/funnel-analysis');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // 截图
    await page.screenshot({
      path: 'test/screenshots/funnel-analysis.png',
      fullPage: true
    });

    // 验证页面包含关键元素
    await expect(page.locator('text=漏斗分析')).toBeVisible();

    console.log('✅ 漏斗分析页面验证完成');
  });

  test('验证用户路径分析页面', async ({ page }) => {
    await page.goto('http://localhost:8000/dashboard/user-path');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // 截图
    await page.screenshot({
      path: 'test/screenshots/user-path-analysis.png',
      fullPage: true
    });

    // 验证页面包含关键元素
    await expect(page.locator('text=用户路径')).toBeVisible();

    console.log('✅ 用户路径分析页面验证完成');
  });

  test('验证实时数据页面', async ({ page }) => {
    await page.goto('http://localhost:8000/dashboard/realtime');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // 截图
    await page.screenshot({
      path: 'test/screenshots/realtime-data.png',
      fullPage: true
    });

    // 验证页面包含关键元素
    await expect(page.locator('text=实时数据')).toBeVisible();

    console.log('✅ 实时数据页面验证完成');
  });

  test('验证 SPM 管理页面', async ({ page }) => {
    await page.goto('http://localhost:8000/dashboard/spm');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // 截图
    await page.screenshot({
      path: 'test/screenshots/spm-management.png',
      fullPage: true
    });

    // 验证页面包含关键元素
    await expect(page.locator('text=SPM')).toBeVisible();

    console.log('✅ SPM 管理页面验证完成');
  });

  test('验证 SCM 管理页面', async ({ page }) => {
    await page.goto('http://localhost:8000/dashboard/scm');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // 截图
    await page.screenshot({
      path: 'test/screenshots/scm-management.png',
      fullPage: true
    });

    // 验证页面包含关键元素
    await expect(page.locator('text=SCM')).toBeVisible();

    console.log('✅ SCM 管理页面验证完成');
  });

  test('验证事件管理页面', async ({ page }) => {
    await page.goto('http://localhost:8000/dashboard/events');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // 截图
    await page.screenshot({
      path: 'test/screenshots/event-management.png',
      fullPage: true
    });

    // 验证页面包含关键元素
    await expect(page.locator('text=事件管理')).toBeVisible();

    console.log('✅ 事件管理页面验证完成');
  });

  test('验证属性管理页面', async ({ page }) => {
    await page.goto('http://localhost:8000/dashboard/properties');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // 截图
    await page.screenshot({
      path: 'test/screenshots/property-management.png',
      fullPage: true
    });

    // 验证页面包含关键元素
    await expect(page.locator('text=属性管理')).toBeVisible();

    console.log('✅ 属性管理页面验证完成');
  });
});
