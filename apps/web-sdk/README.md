# @probe-x/web-sdk

[![npm version](https://badge.fury.io/js/@probe-x%2Fweb-sdk.svg)](https://www.npmjs.com/package/@probe-x/web-sdk)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Bundle Size](https://img.shields.io/bundlephobia/minzip/@probe-x/web-sdk)](https://bundlephobia.com/package/@probe-x/web-sdk)

Probe-X Web SDK 是一个轻量级、类型安全的 Web 埋点数据收集 SDK。支持自动埋点、手动埋点、性能监控、会话管理等功能，完全使用 TypeScript 开发。

## 特性

- **自动埋点** - 页面访问、点击、滚动、表单等自动跟踪
- **手动埋点** - 灵活的事件跟踪 API
- **会话管理** - 智能会话识别和管理
- **性能监控** - Web Vitals、资源加载监控
- **错误跟踪** - JS 错误和 Promise 异常自动捕获
- **插件系统** - 可扩展的插件架构
- **TypeScript** - 完整类型定义，开箱即用
- **Tree-shaking** - 支持按需加载，减小包体积
- **多格式** - UMD / ESM / CJS 全覆盖

## 安装

```bash
# npm
npm install @probe-x/web-sdk

# yarn
yarn add @probe-x/web-sdk

# pnpm
pnpm add @probe-x/web-sdk
```

### CDN 引入

```html
<script src="https://cdn.jsdelivr.net/npm/@probe-x/web-sdk@0.1.0/dist/probe-x-sdk.umd.min.js"></script>
```

## 快速开始

### ES Module

```typescript
import ProbeX from '@probe-x/web-sdk';

const probeX = new ProbeX({
  apiUrl: 'https://your-api.com/point/report',
  appId: 'your-app-id',
  debug: true,
});

// 手动埋点
probeX.track('button_click', {
  button_name: '登录按钮',
  page: 'login',
});
```

### CommonJS

```javascript
const ProbeX = require('@probe-x/web-sdk');

const probeX = new ProbeX({
  apiUrl: 'https://your-api.com/point/report',
  appId: 'your-app-id',
});
```

### 浏览器 UMD

```html
<script src="https://cdn.jsdelivr.net/npm/@probe-x/web-sdk@0.1.0/dist/probe-x-sdk.umd.min.js"></script>
<script>
  const probeX = new ProbeX({
    apiUrl: 'https://your-api.com/point/report',
    appId: 'your-app-id',
  });

  probeX.track('page_view');
</script>
```

## 配置选项

```typescript
import type { ProbeXConfig } from '@probe-x/web-sdk';

const config: ProbeXConfig = {
  // === 基础配置（必需） ===
  apiUrl: 'https://your-api.com/point/report', // 数据上报地址
  appId: 'your-app-id',                         // 应用 ID

  // === 调试 ===
  debug: false,                  // 开启调试日志

  // === 自动埋点 ===
  autoTrack: true,               // 总开关
  autoTrackPageView: true,       // 页面访问
  autoTrackClick: true,          // 点击事件
  autoTrackScroll: true,         // 滚动事件
  autoTrackForm: true,           // 表单事件
  autoTrackHashChange: true,     // Hash 变化
  autoTrackUnload: true,         // 页面卸载

  // === 发送策略 ===
  batchSize: 10,                 // 批量发送大小
  flushInterval: 5000,           // 发送间隔（ms）
  maxRetries: 3,                 // 最大重试次数
  retryDelay: 1000,              // 重试延迟（ms）
  sendTimeout: 10000,            // 发送超时（ms）

  // === 存储 ===
  storageType: 'localStorage',   // 'localStorage' | 'sessionStorage' | 'memory'
  maxStorageSize: 1000,          // 最大存储事件数
  storagePrefix: 'probe_x_',    // 存储键前缀

  // === 过滤 ===
  blacklistUrls: [],             // URL 黑名单
  whitelistUrls: [],             // URL 白名单
  blacklistEvents: [],           // 事件黑名单
  whitelistEvents: [],           // 事件白名单

  // === 采样 ===
  sampling: 1.0,                 // 采样率 (0-1)

  // === 功能开关 ===
  enableHeartbeat: true,         // 心跳保活
  heartbeatInterval: 30000,      // 心跳间隔（ms）
  enableErrorTracking: true,     // 错误跟踪
  enablePerformanceTracking: true, // 性能监控
  enableNetworkTracking: false,  // 网络请求监控
  enableResourceTracking: false, // 资源加载监控
  enableHeatmap: false,          // 热力图
  enableSessionReplay: false,    // 会话重放

  // === 隐私 ===
  respectDNT: true,              // 尊重 Do Not Track
  anonymizeIP: false,            // IP 匿名化
  maskSensitiveData: true,       // 敏感数据脱敏
};

const probeX = new ProbeX(config);
```

## API 文档

### 核心方法

#### `track(eventName, properties?, options?)`

手动发送埋点事件。

```typescript
probeX.track('purchase', {
  product_id: 'prod_123',
  product_name: '商品名称',
  price: 99.99,
  currency: 'CNY',
}, {
  priority: 'high',     // 'low' | 'normal' | 'high'
  immediate: true,      // 立即发送，不进入批量队列
});
```

#### `setUser(userProperties)`

设置用户属性，后续事件自动附带。

```typescript
probeX.setUser({
  user_id: '12345',
  user_name: '张三',
  user_type: 'premium',
  email: 'zhangsan@example.com',
});
```

#### `setGlobalProperties(globalProperties)`

设置全局属性，所有事件都会携带。

```typescript
probeX.setGlobalProperties({
  app_version: '1.0.0',
  environment: 'production',
  channel: 'web',
});
```

#### `setConfig(key, value)` / `getConfig(key, defaultValue?)`

运行时读写配置。

```typescript
probeX.setConfig('debug', true);
probeX.setConfig('sampling', 0.5);

const debug = probeX.getConfig('debug', false);
```

#### `flush()`

手动触发数据发送。

```typescript
await probeX.flush();
```

#### `destroy()`

销毁 SDK 实例，清理所有监听器和定时器。

```typescript
probeX.destroy();
```

### 信息获取

```typescript
// 会话信息
const session = probeX.getSession();
// { id: string, startTime: number, duration: number }

// 性能数据
const perf = probeX.getPerformanceData();

// 页面信息
const page = probeX.getPageInfo();

// 浏览器信息
const browser = probeX.getBrowserInfo();

// 屏幕信息
const screen = probeX.getScreenInfo();
```

### 插件系统

```typescript
import type { Plugin } from '@probe-x/web-sdk';

// 自定义插件
class MyPlugin implements Plugin {
  name = 'my-plugin';
  version = '1.0.0';

  install(sdk: any, options?: any): void {
    // 初始化逻辑
  }

  uninstall(): void {
    // 清理逻辑
  }
}

probeX.use(new MyPlugin(), { /* options */ });
```

## 自动埋点事件

SDK 自动采集以下事件：

| 事件名 | 触发时机 | 主要属性 |
|--------|---------|---------|
| `page_view` | 页面加载 | `page_title`, `page_url`, `referrer` |
| `click` | 用户点击 | `element_type`, `element_text`, `click_x/y` |
| `form_submit` | 表单提交 | `form_id`, `form_fields` |
| `page_stay` | 页面卸载 | `stay_time`, `page_url` |
| `page_show` | 页面重新可见 | `hidden_duration` |
| `scroll` | 页面滚动 | `scroll_depth`, `scroll_direction` |

## 浏览器兼容性

| 浏览器 | 最低版本 |
|--------|---------|
| Chrome | 60+ |
| Firefox | 55+ |
| Safari | 12+ |
| Edge | 79+ |
| IE | 11（需 polyfill） |

### IE 11 Polyfill

```html
<script src="https://cdn.jsdelivr.net/npm/es6-promise@4/dist/es6-promise.auto.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/whatwg-fetch@3.6.2/dist/fetch.umd.js"></script>
```

## 构建产物

| 文件 | 格式 | 用途 |
|------|------|------|
| `dist/probe-x-sdk.umd.js` | UMD | `<script>` 标签引入 |
| `dist/probe-x-sdk.umd.min.js` | UMD (压缩) | 生产环境 CDN |
| `dist/probe-x-sdk.esm.js` | ESM | `import` 引入，支持 tree-shaking |
| `dist/probe-x-sdk.esm.min.js` | ESM (压缩) | 生产环境 bundler |
| `dist/probe-x-sdk.cjs.js` | CJS | `require()` 引入 |
| `dist/probe-x-sdk.cjs.min.js` | CJS (压缩) | Node.js 环境 |
| `dist/probe-x-sdk.d.ts` | TypeScript | 类型定义 |

## 开发

```bash
# 克隆项目
git clone https://github.com/ComfortableLiu/probe-x.git
cd probe-x/apps/web-sdk

# 安装依赖
npm install

# 开发模式（watch）
npm run dev

# 类型检查
npm run type-check

# 运行测试
npm test

# 构建
npm run build

# 检查包体积
npm run size
```

## 发布

```bash
# 从项目根目录执行
./scripts/publish-sdk.sh           # 发布 patch 版本
./scripts/publish-sdk.sh minor     # 发布 minor 版本
./scripts/publish-sdk.sh --beta    # 发布 beta 版本
./scripts/publish-sdk.sh --dry-run # 仅构建，不发布
```

## 隐私与安全

```typescript
const probeX = new ProbeX({
  maskSensitiveData: true,  // 自动脱敏密码等敏感字段
  respectDNT: true,         // 尊重浏览器 DNT 设置
  anonymizeIP: true,        // IP 匿名化
  sampling: 0.5,            // 50% 采样，减少数据量
  blacklistUrls: ['/admin', /\/private\/.*/],
});
```

## 故障排除

**数据没有发送？**
- 检查 `apiUrl` 和 `appId` 配置
- 开启 `debug: true` 查看日志
- 检查浏览器控制台是否有 CORS 错误

**自动埋点不生效？**
- 确认 `autoTrack: true`
- 检查 URL 过滤配置是否排除了当前页面

**TypeScript 类型报错？**
- 确保 TypeScript >= 4.7
- 检查 `tsconfig.json` 中 `moduleResolution` 设置

## 许可证

[MIT](LICENSE) © [逍遥成居士](https://github.com/ComfortableLiu)
