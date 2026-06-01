# Claude Code CLI 提示词 — 生成 Probe-X E2E 测试用例

请复制以下整段提示词，粘贴到 Claude Code CLI 中执行：

---

## 提示词

```
请为 Probe-X 项目编写完整的 Playwright E2E 测试用例。项目是一个 Nx monorepo 前端数据分析平台。

## 已创建的文件（不要修改）

- test/playwright.config.ts — Playwright 配置
- test/utils/test-helpers.ts — 测试工具函数（bypassLogin, navigateTo, takeScreenshot, clickMenuItem, clickSubMenuItem, waitForTable, waitForLoadingDone, collectErrors 等）
- test/fixtures/test-data.ts — 测试数据常量（ALL_PAGES, SIDEBAR_MODULES 等）

## 需要创建的测试文件

所有测试文件放在 test/e2e/ 目录下。

### 1. test/e2e/01-login.spec.ts — 登录页面测试
- 测试 /login 页面渲染（表单、输入框、按钮）
- 测试空用户名/密码提交时的表单验证
- 测试路由守卫：未登录访问 / 应重定向到 /login
- 测试 bypassLogin 后能正常访问首页

### 2. test/e2e/02-navigation.spec.ts — 导航和菜单测试
- 先 bypassLogin 注入 token
- 测试侧边栏菜单可见且结构正确（5个一级菜单）
- 测试点击每个一级菜单能展开子菜单
- 测试点击每个子菜单项能正确导航到对应 URL
- 测试所有 SIDEBAR_MODULES 中的路径都能加载

### 3. test/e2e/03-homepage.spec.ts — 首页测试
- bypassLogin 后访问 /
- 测试页面标题或面包屑
- 测试统计卡片区域渲染
- 测试图表区域存在
- 测试表格区域存在
- 截图保存

### 4. test/e2e/04-point-manage.spec.ts — 埋点管理模块测试
对每个子页面（event, property, spm, scm, basic-coding）:
- 导航到页面
- 测试页面主要区域渲染（表格、按钮、筛选器）
- 测试无报错
- 截图保存

### 5. test/e2e/05-data-analysis.spec.ts — 数据分析模块测试
对每个子页面（event, funnel, free, userPath, attribution, dashboardConfig）:
- 导航到页面
- 测试页面主要区域渲染
- 测试配置区域/表单区域存在
- 测试无报错
- 截图保存

### 6. test/e2e/06-system-data.spec.ts — 系统数据模块测试
对每个子页面（overview, analysis, meta, computingNode）:
- 导航到页面
- 测试页面主要区域渲染
- 测试统计卡片/图表存在
- 测试无报错
- 截图保存

### 7. test/e2e/07-system-config.spec.ts — 系统设置模块测试
对每个子页面（user, system, computing-node, role, system-params, datasource, notification, log-config, project, audit-log, alert）:
- 导航到页面
- 测试页面主要区域渲染（表格、表单）
- 测试无报错
- 截图保存

### 8. test/e2e/08-account.spec.ts — 个人中心测试
- 导航到 /account
- 测试个人信息区域渲染
- 测试表单字段存在

## 技术要求

1. 使用 @playwright/test 的 test 和 expect
2. 每个测试前用 bypassLogin() 注入认证（除了登录页测试）
3. 用 collectErrors() 收集页面错误，在每个测试的 afterAll 或 afterEach 中报告
4. 用 takeScreenshot() 在关键节点截图
5. 用 navigateTo() 导航页面
6. 超时设置合理（页面加载 30s，操作 15s）
7. 测试应该能在后端 API 不可用时也运行 — 重点测试页面渲染和交互，不依赖真实数据
8. 使用 test.describe 按模块分组
9. 文件名带序号确保执行顺序
10. 所有 import 使用相对路径

## 重要：后端 API 可能不可用

后端服务（MySQL/ClickHouse/Kafka）可能未运行，所以：
- 不要测试依赖真实数据返回的功能
- 重点测试：页面能加载、布局正确、组件渲染、无 JS 崩溃
- API 请求失败不应导致测试失败，用 page.route() mock API 返回空数据或跳过数据验证
- 测试页面在空数据/错误状态下的优雅降级

## 页面路径参考

使用 test/fixtures/test-data.ts 中的 ALL_PAGES 常量获取所有页面路径。
```
