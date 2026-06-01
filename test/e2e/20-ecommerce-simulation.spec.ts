import { test, expect, Page } from '@playwright/test';

const DEMO = 'http://localhost:9000';
const SCREENSHOTS = 'test/screenshots/ecommerce-flow';

async function screenshot(page: Page, name: string) {
  await page.screenshot({ path: `${SCREENSHOTS}/${name}.png`, fullPage: true });
  console.log(`  📸 ${name}.png`);
}

async function waitReady(page: Page) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(2000);
}

test.describe('电商用户行为模拟', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
  });
  // 增加超时到 90s
  test.setTimeout(90000);

  test('场景1: 完整购物流程（首页→列表→详情→加购→购物车→结算）', async ({ page }) => {
    console.log('\n🎬 场景1: 完整购物流程');

    // Step 1: 首页
    console.log('  Step 1: 访问首页');
    await page.goto(DEMO);
    await waitReady(page);
    await screenshot(page, 's1-01-homepage');

    // Step 2: 导航到商品列表
    console.log('  Step 2: 进入商品列表');
    // 点击导航栏的"全部商品"或"商品列表"链接
    const navLink = page.locator('a').filter({ hasText: /商品|产品|Product/ }).first();
    if (await navLink.isVisible().catch(() => false)) {
      await navLink.click();
    } else {
      await page.goto(DEMO + '/products');
    }
    await waitReady(page);
    await screenshot(page, 's1-02-product-list');

    // Step 3: 点击第一个商品进入详情
    console.log('  Step 3: 查看商品详情');
    // 尝试多种选择器
    const productLink = page.locator('a[href*="/products/"]').first()
      .or(page.locator('.ant-card').first())
      .or(page.locator('[class*="product"]').first());
    if (await productLink.isVisible().catch(() => false)) {
      await productLink.click();
    } else {
      await page.goto(DEMO + '/products/1');
    }
    await waitReady(page);
    await screenshot(page, 's1-03-product-detail');

    // Step 4: 加入购物车
    console.log('  Step 4: 加入购物车');
    const addBtn = page.locator('button').filter({ hasText: /加入购物车|加购|Add.*Cart/i }).first();
    if (await addBtn.isVisible().catch(() => false)) {
      await addBtn.click();
      await page.waitForTimeout(1500);
      await screenshot(page, 's1-04-added-to-cart');
    }

    // Step 5: 去购物车
    console.log('  Step 5: 进入购物车');
    await page.goto(DEMO + '/cart');
    await waitReady(page);
    await screenshot(page, 's1-05-cart');

    // Step 6: 去结算
    console.log('  Step 6: 结算页面');
    const checkoutBtn = page.locator('button').filter({ hasText: /结算|结账|去结算|Checkout/i }).first();
    if (await checkoutBtn.isVisible().catch(() => false)) {
      await checkoutBtn.click();
    } else {
      await page.goto(DEMO + '/checkout');
    }
    await waitReady(page);
    await screenshot(page, 's1-06-checkout');

    // Step 7: 提交订单
    console.log('  Step 7: 提交订单');
    const submitBtn = page.locator('button').filter({ hasText: /提交订单|确认下单|Submit|Place.*Order/i }).first();
    if (await submitBtn.isVisible().catch(() => false)) {
      await submitBtn.click();
      await page.waitForTimeout(2000);
      await screenshot(page, 's1-07-order-submitted');
    }

    console.log('  ✅ 场景1完成');
  });

  test('场景2: 搜索并浏览商品', async ({ page }) => {
    console.log('\n🎬 场景2: 搜索并浏览');

    await page.goto(DEMO);
    await waitReady(page);

    // 搜索
    console.log('  Step 1: 搜索 iPhone');
    const searchInput = page.locator('input[placeholder*="搜索"], input[type="search"], input[id*="search"]').first();
    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill('iPhone');
      await searchInput.press('Enter');
      await waitReady(page);
      await screenshot(page, 's2-01-search-iphone');
    } else {
      await page.goto(DEMO + '/search?keyword=iPhone');
      await waitReady(page);
      await screenshot(page, 's2-01-search-iphone');
    }

    // 再搜索 MacBook
    console.log('  Step 2: 搜索 MacBook');
    const searchInput2 = page.locator('input[placeholder*="搜索"], input[type="search"], input[id*="search"]').first();
    if (await searchInput2.isVisible().catch(() => false)) {
      await searchInput2.fill('MacBook');
      await searchInput2.press('Enter');
      await waitReady(page);
    }
    await screenshot(page, 's2-02-search-macbook');

    // 浏览商品详情
    console.log('  Step 3: 查看搜索结果商品');
    await page.goto(DEMO + '/products/2');
    await waitReady(page);
    await screenshot(page, 's2-03-product-2');

    await page.goto(DEMO + '/products/3');
    await waitReady(page);
    await screenshot(page, 's2-03-product-3');

    console.log('  ✅ 场景2完成');
  });

  test('场景3: 多页面深度浏览', async ({ page }) => {
    console.log('\n🎬 场景3: 深度浏览');

    const pages = [
      { url: '/', name: 'home' },
      { url: '/products', name: 'products' },
      { url: '/products/1', name: 'product-1' },
      { url: '/products/2', name: 'product-2' },
      { url: '/products/3', name: 'product-3' },
      { url: '/cart', name: 'cart' },
      { url: '/orders', name: 'orders' },
      { url: '/profile', name: 'profile' },
    ];

    for (let i = 0; i < pages.length; i++) {
      console.log(`  Step ${i+1}: ${pages[i].url}`);
      await page.goto(DEMO + pages[i].url);
      await waitReady(page);
      await screenshot(page, `s3-${String(i+1).padStart(2, '0')}-${pages[i].name}`);
    }

    console.log('  ✅ 场景3完成');
  });

  test('场景4: 分类筛选和排序', async ({ page }) => {
    console.log('\n🎬 场景4: 分类筛选和排序');

    await page.goto(DEMO + '/products');
    await waitReady(page);
    await screenshot(page, 's4-01-all-products');

    // 尝试分类筛选
    console.log('  Step 1: 分类筛选');
    const categoryBtn = page.locator('.ant-tag, .ant-radio-button-wrapper, [class*="filter"], [class*="category"]').filter({ hasText: /手机|数码|电脑/ }).first();
    if (await categoryBtn.isVisible().catch(() => false)) {
      await categoryBtn.click();
      await page.waitForTimeout(1500);
      await screenshot(page, 's4-02-category-filter');
    }

    // 尝试排序
    console.log('  Step 2: 排序');
    const sortBtn = page.locator('.ant-select, [class*="sort"], button').filter({ hasText: /价格|排序|销量/ }).first();
    if (await sortBtn.isVisible().catch(() => false)) {
      await sortBtn.click();
      await page.waitForTimeout(1500);
      await screenshot(page, 's4-03-sort');
    }

    console.log('  ✅ 场景4完成');
  });

  test('场景5: 用户中心操作', async ({ page }) => {
    console.log('\n🎬 场景5: 用户中心');

    await page.goto(DEMO + '/profile');
    await waitReady(page);
    await screenshot(page, 's5-01-profile');

    await page.goto(DEMO + '/orders');
    await waitReady(page);
    await screenshot(page, 's5-02-orders');

    // 查看第一个订单详情
    const orderLink = page.locator('a[href*="/orders/"]').first();
    if (await orderLink.isVisible().catch(() => false)) {
      await orderLink.click();
      await waitReady(page);
      await screenshot(page, 's5-03-order-detail');
    }

    console.log('  ✅ 场景5完成');
  });

  test('场景6: 快速连续操作（模拟高频用户）', async ({ page }) => {
    console.log('\n🎬 场景6: 高频用户操作');

    // 快速浏览多个商品
    for (let id = 1; id <= 6; id++) {
      console.log(`  快速浏览商品 ${id}`);
      await page.goto(DEMO + `/products/${id}`);
      await page.waitForTimeout(800);

      // 快速加购
      const addBtn = page.locator('button').filter({ hasText: /加入购物车|加购|Add/i }).first();
      if (await addBtn.isVisible().catch(() => false)) {
        await addBtn.click();
        await page.waitForTimeout(500);
      }
    }
    await screenshot(page, 's6-01-rapid-browse');

    // 去购物车
    await page.goto(DEMO + '/cart');
    await waitReady(page);
    await screenshot(page, 's6-02-cart-full');

    console.log('  ✅ 场景6完成');
  });
});
