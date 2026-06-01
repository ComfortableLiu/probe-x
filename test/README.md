# Probe-X E2E 测试

基于 Playwright + Firefox 的端到端测试套件，覆盖全部页面模块。

## 目录结构

```
test/
├── playwright.config.ts        # Playwright 配置 (Firefox, baseURL: localhost:8000)
├── run-e2e.sh                  # 一键运行脚本
├── static-server.js            # 前端静态文件服务器 (port 8000, 处理 publicPath 映射)
├── mock-api-server.js          # Mock API 服务器 (port 8101, 模拟全部后端接口)
├── CLAUDE_PROMPT.md            # Claude Code CLI 生成测试的提示词
├── README.md                   # 本文件
├── e2e/                        # 测试用例 (8 个文件, 36 个测试)
│   ├── 01-login.spec.ts        #   登录页: 渲染/表单验证/路由守卫/bypass
│   ├── 02-navigation.spec.ts   #   导航: 布局/URL直接导航/全路径加载
│   ├── 03-homepage.spec.ts     #   首页: 渲染/布局结构
│   ├── 04-point-manage.spec.ts #   埋点管理: 事件/属性/SPM/SCM/基础编码
│   ├── 05-data-analysis.spec.ts#   数据分析: 事件/漏斗/自由/路径/归因/看板
│   ├── 06-system-data.spec.ts  #   系统数据: 总览/数分/元数据/计算节点
│   ├── 07-system-config.spec.ts#   系统设置: 11个子页面全覆盖
│   └── 08-account.spec.ts      #   个人中心
├── utils/
│   └── test-helpers.ts         # 工具函数 (bypassLogin, mockApi, navigateTo, etc.)
├── fixtures/
│   └── test-data.ts            # 页面路径和菜单结构常量
├── screenshots/                # 测试截图 (自动生成)
├── test-reports/               # HTML 测试报告 (自动生成)
└── test-results/               # Playwright 原始结果 (自动生成)
```

## 前置条件

- Node.js 22+
- `@playwright/test` 已安装 (`yarn add -D -W @playwright/test`)
- Firefox 浏览器已安装 (`npx playwright install firefox`)

## 快速开始

```bash
# 方式一：一键脚本 (交互式，自动启动缺失服务)
bash test/run-e2e.sh

# 方式二：手动启动 + 运行
node test/static-server.js &      # 前端静态服务 :8000
node test/mock-api-server.js &    # Mock API :8101
npx playwright test --config=test/playwright.config.ts

# 方式三：连接真实后端 (需要 MySQL/ClickHouse/Kafka/Redis)
node test/static-server.js &      # 只需启动前端，后端用真实的
npx playwright test --config=test/playwright.config.ts
```

## 测试结果

```
Running 36 tests using 1 worker

  ✓  01-01 登录页应正确渲染
  ✓  01-02 空表单提交应触发验证提示
  ✓  01-03 未登录访问首页应重定向到登录页
  ✓  01-04 bypassLogin 后应能访问首页
  ✓  02-01 首页应渲染并包含基本布局元素
  ✓  02-02 通过 URL 直接导航到各模块页面
  ✓  02-03 所有主要路径都能加载无崩溃
  ✓  03-01 首页应正确渲染无崩溃
  ✓  03-02 首页应包含基本布局结构
  ✓  04 事件管理 / 属性管理 / SPM管理 / SCM管理 / 基础编码管理  (5 tests)
  ✓  05 事件分析 / 漏斗分析 / 自由分析 / 用户路径 / 归因分析 / 看板设置  (6 tests)
  ✓  06 总览 / 数分数据 / 元数据 / 计算节点  (4 tests)
  ✓  07 用户管理 / 系统管理 / 计算节点 / 角色 / 参数 / 数据源 / 通知 / 日志 / 项目 / 审计 / 告警  (11 tests)
  ✓  08-01 个人中心页面应正确渲染

  36 passed (2.0m)
```

## 测试覆盖

| 模块 | 页面数 | 测试内容 |
|------|--------|---------|
| 登录 | 4 | 表单渲染、输入验证、路由守卫重定向、bypass 登录后访问 |
| 导航 | 3 | 首页布局渲染、URL 直接导航 7 个模块、6 条主要路径全加载 |
| 首页 | 2 | 页面渲染无崩溃、基本布局结构完整 |
| 埋点管理 | 5 | 事件/属性/SPM/SCM/基础编码 — 页面渲染、无白屏错误 |
| 数据分析 | 6 | 事件/漏斗/自由/路径/归因/看板 — 页面渲染、无白屏错误 |
| 系统数据 | 4 | 总览/数分/元数据/计算节点 — 页面渲染、无白屏错误 |
| 系统设置 | 11 | 用户/系统/节点/角色/参数/数据源/通知/日志/项目/审计/告警 |
| 个人中心 | 1 | 页面渲染、无崩溃 |

**总计：36 个测试用例，覆盖 28+ 个页面路由**

## 技术说明

- **浏览器**: Firefox（Playwright 内置），因 Chromium 在 macOS 沙箱中 Mach port 权限受限
- **认证绕过**: 通过 `bypassLogin()` 注入假 token 到 localStorage（需用 `JSON.stringify` 包装，匹配前端 `Localstorage.get()` 的 `JSON.parse` 逻辑）
- **API Mock**: 独立 Node.js HTTP 服务器在 8101 端口运行，返回全部 `/api/*` 接口的 mock 数据
- **静态服务**: 自定义服务器处理 `publicPath: '/assets/'` 到实际 `css/`/`js/` 目录的映射
- **错误过滤**: 自动过滤 API 网络错误，只关注 JS 崩溃和白屏
