import { test, expect, Page } from '@playwright/test';

const BASE = 'http://localhost:8000';
const API = 'http://localhost:8101';
const SCREENSHOTS = 'test/screenshots/e2e-flow';

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function screenshot(page: Page, name: string) {
  await page.screenshot({ path: `${SCREENSHOTS}/${name}.png`, fullPage: true });
  console.log(`  📸 ${name}.png`);
}

async function login(page: Page) {
  console.log('🔐 Step 1: 登录 Probe-X 后台');
  await page.goto(`${BASE}/login`);
  await page.waitForLoadState('networkidle').catch(() => {});
  await sleep(2000);
  await screenshot(page, '00-01-login-page');

  // 填写用户名和密码
  await page.locator('#normal_login_username').fill('admin');
  await page.locator('#normal_login_password').fill('admin123');
  await screenshot(page, '00-02-login-filled');

  // 点击登录
  await page.locator('button[type="submit"]').click();
  await sleep(3000);

  // 如果跳转到首页或URL不再是login，说明登录成功
  const url = page.url();
  console.log(`  登录后 URL: ${url}`);
  await screenshot(page, '00-03-after-login');
}

test.describe('Phase 1: 系统初始化 - 创建系统和SPM/SCM', () => {
  test('01 登录并创建系统', async ({ page }) => {
    await login(page);

    // === 创建系统 (System) ===
    console.log('🏢 Step 2: 创建电商系统');
    await page.goto(`${BASE}/system-config/system`);
    await sleep(2000);
    await screenshot(page, '01-01-system-config-page');

    // 点击新增按钮
    const addBtn = page.locator('button').filter({ hasText: /新增|新建|添加|创建/ }).first();
    if (await addBtn.isVisible().catch(() => false)) {
      await addBtn.click();
      await sleep(1000);
      await screenshot(page, '01-02-add-system-modal');

      // 填写系统信息
      const inputs = page.locator('.ant-modal input, .ant-drawer input');
      const count = await inputs.count();
      console.log(`  表单输入框数量: ${count}`);

      // 尝试填写系统名称和标识
      if (count >= 2) {
        await inputs.nth(0).fill('电商演示系统');
        await inputs.nth(1).fill('ecommerce-demo');
      }
      if (count >= 3) {
        await inputs.nth(2).fill('Probe-X 电商演示平台');
      }

      await screenshot(page, '01-03-system-filled');

      // 点击确认/保存
      const saveBtn = page.locator('.ant-modal button, .ant-drawer button').filter({ hasText: /确定|保存|提交|确认/ }).first();
      if (await saveBtn.isVisible().catch(() => false)) {
        await saveBtn.click();
        await sleep(2000);
      }
      await screenshot(page, '01-04-system-saved');
    } else {
      console.log('  ⚠️ 未找到新增按钮，可能页面加载不完整');
    }
  });

  test('02 创建 SPM 四级结构', async ({ page }) => {
    await login(page);

    console.log('📍 Step 3: 创建 SPM 四级结构');
    await page.goto(`${BASE}/point-manage/spm`);
    await sleep(3000);
    await screenshot(page, '02-01-spm-page');

    // SPM 页面是三栏 Splitter 布局：业务线 -> 页面 -> 模块 -> 点位
    // 先创建一级节点（业务线）
    const addBtns = page.locator('button').filter({ hasText: /新增|新建|添加/ });
    const btnCount = await addBtns.count();
    console.log(`  新增按钮数量: ${btnCount}`);

    if (btnCount > 0) {
      // 点击第一个新增按钮创建业务线
      await addBtns.first().click();
      await sleep(1000);
      await screenshot(page, '02-02-spm-add-level1');

      // 填写业务线名称
      const modalInputs = page.locator('.ant-modal input, .ant-drawer input, .ant-popover input');
      const inputCount = await modalInputs.count();
      console.log(`  弹窗输入框数量: ${inputCount}`);

      if (inputCount >= 1) {
        await modalInputs.first().fill('ecommerce');
      }
      if (inputCount >= 2) {
        await modalInputs.nth(1).fill('电商业务');
      }

      await screenshot(page, '02-03-spm-level1-filled');

      // 确认
      const confirmBtn = page.locator('.ant-modal button, .ant-drawer button, .ant-popover button').filter({ hasText: /确定|保存|确认/ }).first();
      if (await confirmBtn.isVisible().catch(() => false)) {
        await confirmBtn.click();
        await sleep(2000);
      }
      await screenshot(page, '02-04-spm-level1-created');

      // 创建二级节点（页面）- 点击第一个业务线节点
      const treeNodes = page.locator('.ant-tree-treenode, .ant-tree-node-content-wrapper, [class*="node"]');
      const nodeCount = await treeNodes.count();
      console.log(`  树节点数量: ${nodeCount}`);

      if (nodeCount > 0) {
        await treeNodes.first().click();
        await sleep(1000);

        // 点击新增页面按钮
        if (btnCount > 1) {
          await addBtns.nth(1).click();
          await sleep(1000);
          await screenshot(page, '02-05-spm-add-level2');

          const modalInputs2 = page.locator('.ant-modal input, .ant-drawer input, .ant-popover input');
          if (await modalInputs2.count() >= 1) {
            await modalInputs2.first().fill('home');
          }
          if (await modalInputs2.count() >= 2) {
            await modalInputs2.nth(1).fill('首页');
          }

          const confirmBtn2 = page.locator('.ant-modal button, .ant-drawer button, .ant-popover button').filter({ hasText: /确定|保存|确认/ }).first();
          if (await confirmBtn2.isVisible().catch(() => false)) {
            await confirmBtn2.click();
            await sleep(1500);
          }
          await screenshot(page, '02-06-spm-level2-created');
        }
      }
    }

    await screenshot(page, '02-07-spm-final');
  });

  test('03 创建 SCM 四级结构', async ({ page }) => {
    await login(page);

    console.log('🏷️ Step 4: 创建 SCM 四级结构');
    await page.goto(`${BASE}/point-manage/scm`);
    await sleep(3000);
    await screenshot(page, '03-01-scm-page');

    // SCM 是四栏 Splitter：内容来源 -> 配置方式 -> 内容类型 -> 内容ID
    const addBtns = page.locator('button').filter({ hasText: /新增|新建|添加/ });
    const btnCount = await addBtns.count();
    console.log(`  新增按钮数量: ${btnCount}`);

    if (btnCount > 0) {
      await addBtns.first().click();
      await sleep(1000);
      await screenshot(page, '03-02-scm-add-level1');

      const modalInputs = page.locator('.ant-modal input, .ant-drawer input, .ant-popover input');
      if (await modalInputs.count() >= 1) {
        await modalInputs.first().fill('organic');
      }
      if (await modalInputs.count() >= 2) {
        await modalInputs.nth(1).fill('自然流量');
      }

      const confirmBtn = page.locator('.ant-modal button, .ant-drawer button, .ant-popover button').filter({ hasText: /确定|保存|确认/ }).first();
      if (await confirmBtn.isVisible().catch(() => false)) {
        await confirmBtn.click();
        await sleep(1500);
      }
      await screenshot(page, '03-03-scm-level1-created');
    }

    await screenshot(page, '03-04-scm-final');
  });

  test('04 创建事件元数据', async ({ page }) => {
    await login(page);

    console.log('📊 Step 5: 创建事件元数据');
    await page.goto(`${BASE}/point-manage/event`);
    await sleep(3000);
    await screenshot(page, '04-01-event-page');

    // 要创建的事件列表
    const events = [
      { name: 'page_view', desc: '页面浏览事件' },
      { name: 'product_view', desc: '商品浏览事件' },
      { name: 'product_click', desc: '商品点击事件' },
      { name: 'add_to_cart', desc: '加入购物车事件' },
      { name: 'purchase', desc: '购买完成事件' },
      { name: 'search', desc: '搜索事件' },
      { name: 'button_click', desc: '按钮点击事件' },
      { name: 'cart_action', desc: '购物车操作事件' },
    ];

    let created = 0;
    for (const evt of events) {
      const addBtn = page.locator('button').filter({ hasText: /新增|新建|注册|添加/ }).first();
      if (await addBtn.isVisible().catch(() => false)) {
        await addBtn.click();
        await sleep(1000);

        const modalInputs = page.locator('.ant-modal input, .ant-drawer input');
        const inputCount = await modalInputs.count();

        if (inputCount >= 1) await modalInputs.first().fill(evt.name);
        if (inputCount >= 2) await modalInputs.nth(1).fill(evt.desc);

        const confirmBtn = page.locator('.ant-modal button, .ant-drawer button').filter({ hasText: /确定|保存|确认/ }).first();
        if (await confirmBtn.isVisible().catch(() => false)) {
          await confirmBtn.click();
          await sleep(1000);
          created++;
        }
      }
    }

    console.log(`  创建事件数: ${created}/${events.length}`);
    await screenshot(page, '04-02-events-created');
  });

  test('05 创建属性元数据', async ({ page }) => {
    await login(page);

    console.log('🏷️ Step 6: 创建属性元数据');
    await page.goto(`${BASE}/point-manage/property`);
    await sleep(3000);
    await screenshot(page, '05-01-property-page');

    const properties = [
      { name: 'product_id', desc: '商品ID', type: 'string' },
      { name: 'product_name', desc: '商品名称', type: 'string' },
      { name: 'product_price', desc: '商品价格', type: 'number' },
      { name: 'product_category', desc: '商品分类', type: 'string' },
      { name: 'quantity', desc: '数量', type: 'number' },
      { name: 'total_amount', desc: '总金额', type: 'number' },
      { name: 'keyword', desc: '搜索关键词', type: 'string' },
      { name: 'page_name', desc: '页面名称', type: 'string' },
    ];

    let created = 0;
    for (const prop of properties) {
      const addBtn = page.locator('button').filter({ hasText: /新增|新建|添加/ }).first();
      if (await addBtn.isVisible().catch(() => false)) {
        await addBtn.click();
        await sleep(1000);

        const modalInputs = page.locator('.ant-modal input, .ant-drawer input');
        const inputCount = await modalInputs.count();

        if (inputCount >= 1) await modalInputs.first().fill(prop.name);
        if (inputCount >= 2) await modalInputs.nth(1).fill(prop.desc);

        const confirmBtn = page.locator('.ant-modal button, .ant-drawer button').filter({ hasText: /确定|保存|确认/ }).first();
        if (await confirmBtn.isVisible().catch(() => false)) {
          await confirmBtn.click();
          await sleep(1000);
          created++;
        }
      }
    }

    console.log(`  创建属性数: ${created}/${properties.length}`);
    await screenshot(page, '05-02-properties-created');
  });
});
