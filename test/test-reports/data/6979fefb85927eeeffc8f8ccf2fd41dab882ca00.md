# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 01-login.spec.ts >> 01 登录页面测试 >> 01-03 未登录访问首页应重定向到登录页
- Location: test/e2e/01-login.spec.ts:79:7

# Error details

```
Error: expect(page).toHaveURL(expected) failed

Expected pattern: /\/login/
Received string:  "http://localhost:8000/"
Timeout: 5000ms

Call log:
  - Expect "toHaveURL" with timeout 5000ms
    14 × unexpected value "http://localhost:8000/"

```

# Test source

```ts
  3   | /**
  4   |  * Bypass login by injecting auth tokens directly into localStorage.
  5   |  * This avoids needing real backend authentication for E2E tests.
  6   |  */
  7   | export async function bypassLogin(page: Page, token = 'e2e-test-token') {
  8   |   await page.goto('/login');
  9   |   await page.evaluate((t) => {
  10  |     localStorage.setItem('PROBE-X-access_token', t);
  11  |     localStorage.setItem('PROBE-X-refresh_token', 'e2e-test-refresh-token');
  12  |     localStorage.setItem(
  13  |       'PROBE-X-userInfo',
  14  |       JSON.stringify({
  15  |         id: 1,
  16  |         username: 'admin',
  17  |         nickname: 'E2E Tester',
  18  |         email: 'test@probe-x.dev',
  19  |         role: 'super_admin',
  20  |         permissions: ['*'],
  21  |       })
  22  |     );
  23  |   }, token);
  24  | }
  25  | 
  26  | /**
  27  |  * Navigate to a page and wait for the main content to load.
  28  |  */
  29  | export async function navigateTo(page: Page, path: string) {
  30  |   await page.goto(path);
  31  |   // Wait for the layout to settle
  32  |   await page.waitForLoadState('networkidle').catch(() => {});
  33  |   await page.waitForTimeout(1000);
  34  | }
  35  | 
  36  | /**
  37  |  * Take a screenshot of the current page and save to test/screenshots/.
  38  |  */
  39  | export async function takeScreenshot(page: Page, name: string) {
  40  |   const sanitized = name.replace(/[^a-zA-Z0-9_-]/g, '_');
  41  |   await page.screenshot({
  42  |     path: `test/screenshots/${sanitized}.png`,
  43  |     fullPage: true,
  44  |   });
  45  | }
  46  | 
  47  | /**
  48  |  * Check that a page renders without console errors.
  49  |  */
  50  | export async function checkNoCriticalErrors(page: Page): Promise<string[]> {
  51  |   const errors: string[] = [];
  52  |   page.on('pageerror', (error) => {
  53  |     errors.push(error.message);
  54  |   });
  55  |   return errors;
  56  | }
  57  | 
  58  | /**
  59  |  * Wait for Ant Design table to load data.
  60  |  */
  61  | export async function waitForTable(page: Page) {
  62  |   await page.waitForSelector('.ant-table', { timeout: 10000 }).catch(() => {});
  63  |   await page.waitForTimeout(500);
  64  | }
  65  | 
  66  | /**
  67  |  * Wait for Ant Design spinners to disappear.
  68  |  */
  69  | export async function waitForLoadingDone(page: Page) {
  70  |   await page
  71  |     .waitForSelector('.ant-spin-spinning', { state: 'hidden', timeout: 15000 })
  72  |     .catch(() => {});
  73  | }
  74  | 
  75  | /**
  76  |  * Click a sidebar menu item by text.
  77  |  */
  78  | export async function clickMenuItem(page: Page, text: string) {
  79  |   const menuItem = page.locator('.ant-menu-item, .ant-menu-submenu-title').filter({ hasText: text });
  80  |   await menuItem.first().click();
  81  |   await page.waitForTimeout(500);
  82  | }
  83  | 
  84  | /**
  85  |  * Expand a sidebar submenu and click a child item.
  86  |  */
  87  | export async function clickSubMenuItem(page: Page, parentText: string, childText: string) {
  88  |   // Click the submenu title to expand
  89  |   const submenuTitle = page.locator('.ant-menu-submenu-title').filter({ hasText: parentText });
  90  |   await submenuTitle.click();
  91  |   await page.waitForTimeout(300);
  92  | 
  93  |   // Click the child menu item
  94  |   const childItem = page.locator('.ant-menu-item').filter({ hasText: childText });
  95  |   await childItem.first().click();
  96  |   await page.waitForTimeout(500);
  97  | }
  98  | 
  99  | /**
  100 |  * Check if the current page shows a login redirect (route guard working).
  101 |  */
  102 | export async function expectLoginRedirect(page: Page) {
> 103 |   await expect(page).toHaveURL(/\/login/);
      |                      ^ Error: expect(page).toHaveURL(expected) failed
  104 | }
  105 | 
  106 | /**
  107 |  * Collect console errors during page interaction.
  108 |  */
  109 | export function collectErrors(page: Page): string[] {
  110 |   const errors: string[] = [];
  111 |   page.on('pageerror', (err) => errors.push(`PageError: ${err.message}`));
  112 |   page.on('console', (msg) => {
  113 |     if (msg.type() === 'error') {
  114 |       errors.push(`ConsoleError: ${msg.text()}`);
  115 |     }
  116 |   });
  117 |   return errors;
  118 | }
  119 | 
```