# Probe-X Web SDK

[![npm version](https://badge.fury.io/js/@probe-x%2Fweb-sdk.svg)](https://badge.fury.io/js/@probe-x%2Fweb-sdk)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Probe-X Web SDK 是一个功能强大、类型安全的埋点数据收集SDK，专为现代Web应用设计。支持自动埋点、手动埋点、性能监控、会话管理等功能，完全使用TypeScript开发，提供完整的类型定义。

## ✨ 特性

### 🎯 核心功能
- **自动埋点**: 页面访问、点击、滚动、表单等自动跟踪
- **手动埋点**: 灵活的事件跟踪API
- **会话管理**: 智能会话识别和管理
- **性能监控**: Web Vitals、资源加载、长任务监控
- **错误跟踪**: JavaScript错误和Promise异常自动捕获

### 🔧 高级功能
- **插件系统**: 可扩展的插件架构
- **热力图**: 用户交互热力图数据收集
- **会话重放**: 用户行为录制和重放
- **A/B测试**: 内置A/B测试支持
- **网络监控**: HTTP请求和响应监控

### 🛡️ 数据安全
- **数据脱敏**: 敏感数据自动脱敏
- **隐私保护**: 支持DNT(Do Not Track)
- **采样控制**: 灵活的数据采样配置
- **离线缓存**: 网络异常时的数据缓存

### 🚀 技术特性
- **TypeScript**: 完整的类型定义和类型安全
- **框架无关**: 可在任何Web框架中使用
- **现代浏览器**: 支持ES2018+特性
- **轻量级**: 压缩后仅约50KB
- **高性能**: 异步处理，不阻塞主线程

## 📦 安装

### NPM
```bash
npm install @probe-x/web-sdk
```

### Yarn
```bash
yarn add @probe-x/web-sdk
```

### CDN
```html
<script src="https://cdn.jsdelivr.net/npm/@probe-x/web-sdk@latest/dist/probe-x-sdk.min.js"></script>
```

## 🚀 快速开始

### ES模块
```typescript
import ProbeX from '@probe-x/web-sdk';

const probeX = new ProbeX({
  apiUrl: 'https://your-api.com/point/report',
  appId: 'your-app-id',
  debug: true
});

// 手动埋点
probeX.track('button_click', {
  button_name: '登录按钮',
  page: 'login'
});
```

### UMD (浏览器)
```html
<script src="https://cdn.jsdelivr.net/npm/@probe-x/web-sdk@latest/dist/probe-x-sdk.min.js"></script>
<script>
  const probeX = new ProbeX({
    apiUrl: 'https://your-api.com/point/report',
    appId: 'your-app-id'
  });
  
  probeX.track('page_view');
</script>
```

### CommonJS
```javascript
const ProbeX = require('@probe-x/web-sdk');

const probeX = new ProbeX({
  apiUrl: 'https://your-api.com/point/report',
  appId: 'your-app-id'
});
```

## ⚙️ 配置选项

```typescript
interface ProbeXConfig {
  // 基础配置
  apiUrl: string;                    // API地址 (必需)
  appId: string;                     // 应用ID (必需)
  debug?: boolean;                   // 调试模式
  
  // 自动埋点
  autoTrack?: boolean;               // 启用自动埋点
  autoTrackPageView?: boolean;       // 页面访问跟踪
  autoTrackClick?: boolean;          // 点击事件跟踪
  autoTrackScroll?: boolean;         // 滚动事件跟踪
  autoTrackForm?: boolean;           // 表单事件跟踪
  autoTrackHashChange?: boolean;     // Hash变化跟踪
  autoTrackUnload?: boolean;         // 页面卸载跟踪
  
  // 发送配置
  batchSize?: number;                // 批量发送大小
  flushInterval?: number;            // 发送间隔(毫秒)
  maxRetries?: number;               // 最大重试次数
  retryDelay?: number;               // 重试延迟(毫秒)
  sendTimeout?: number;              // 发送超时(毫秒)
  
  // 存储配置
  storageType?: 'localStorage' | 'sessionStorage' | 'memory';
  maxStorageSize?: number;           // 最大存储数量
  storagePrefix?: string;            // 存储键前缀
  
  // 过滤配置
  blacklistUrls?: (string | RegExp)[];  // URL黑名单
  whitelistUrls?: (string | RegExp)[];  // URL白名单
  blacklistEvents?: string[];           // 事件黑名单
  whitelistEvents?: string[];           // 事件白名单
  
  // 采样配置
  sampling?: number;                 // 采样率(0-1)
  
  // 功能开关
  enableHeartbeat?: boolean;         // 启用心跳
  heartbeatInterval?: number;        // 心跳间隔(毫秒)
  enableErrorTracking?: boolean;     // 启用错误跟踪
  enablePerformanceTracking?: boolean; // 启用性能跟踪
  enableNetworkTracking?: boolean;   // 启用网络跟踪
  enableResourceTracking?: boolean;  // 启用资源跟踪
  enableHeatmap?: boolean;           // 启用热力图
  enableSessionReplay?: boolean;     // 启用会话重放
  
  // 隐私配置
  respectDNT?: boolean;              // 尊重DNT设置
  anonymizeIP?: boolean;             // IP匿名化
  maskSensitiveData?: boolean;       // 敏感数据脱敏
}
```

## 📊 API文档

### 基础方法

#### `track(eventName, properties?, options?)`
手动发送埋点事件

```typescript
probeX.track('purchase', {
  product_id: 'prod_123',
  product_name: '商品名称',
  price: 99.99,
  currency: 'CNY'
}, {
  priority: 'high',
  immediate: true
});
```

#### `setUser(userProperties)`
设置用户属性

```typescript
probeX.setUser({
  user_id: '12345',
  user_name: '张三',
  user_type: 'premium',
  email: 'zhangsan@example.com'
});
```

#### `setGlobalProperties(globalProperties)`
设置全局属性

```typescript
probeX.setGlobalProperties({
  app_version: '1.0.0',
  environment: 'production',
  channel: 'web'
});
```

### 配置方法

#### `setConfig(key, value)`
设置配置项

```typescript
probeX.setConfig('debug', true);
probeX.setConfig('sampling', 0.5);
```

#### `getConfig(key, defaultValue?)`
获取配置项

```typescript
const debug = probeX.getConfig('debug', false);
const sampling = probeX.getConfig('sampling', 1.0);
```

### 信息获取

#### `getSession()`
获取会话信息

```typescript
const session = probeX.getSession();
console.log(session.id, session.duration);
```

#### `getPerformanceData()`
获取性能数据

```typescript
const performance = probeX.getPerformanceData();
console.log(performance.navigation, performance.vitals);
```

### 插件系统

#### `use(plugin, options?)`
注册插件

```typescript
import { HeatmapPlugin } from '@probe-x/web-sdk';

probeX.use(new HeatmapPlugin(), {
  sampleRate: 0.1
});
```

### 工具方法

```typescript
// 页面信息
const pageInfo = probeX.getPageInfo();

// 浏览器信息
const browserInfo = probeX.getBrowserInfo();

// 屏幕信息
const screenInfo = probeX.getScreenInfo();

// 用户代理
const userAgent = probeX.getUserAgent();
```

## 🔌 插件系统

SDK支持插件扩展，内置以下插件：

### A/B测试插件
```typescript
import { ABTestPlugin } from '@probe-x/web-sdk';

const abTestPlugin = new ABTestPlugin();
probeX.use(abTestPlugin);

// 添加实验
abTestPlugin.addExperiment('button_color', ['red', 'blue'], 0.5);

// 获取变体
const variant = abTestPlugin.getVariant('button_color');
```

### 热力图插件
```typescript
import { HeatmapPlugin } from '@probe-x/web-sdk';

const heatmapPlugin = new HeatmapPlugin();
probeX.use(heatmapPlugin);

// 获取热力图数据
const heatmapData = heatmapPlugin.getHeatmapData();
```

### 会话重放插件
```typescript
import { SessionReplayPlugin } from '@probe-x/web-sdk';

const replayPlugin = new SessionReplayPlugin();
probeX.use(replayPlugin);

// 获取重放数据
const replayData = replayPlugin.getReplayData();
```

## 📱 自动埋点事件

### 页面访问 (page_view)
```typescript
{
  eventName: 'page_view',
  properties: {
    page_title: '页面标题',
    page_url: 'https://example.com/page',
    page_path: '/page',
    referrer: 'https://google.com',
    load_time: 1234.56,
    user_agent: 'Mozilla/5.0...',
    language: 'zh-CN',
    screen_resolution: '1920x1080',
    viewport_size: '1200x800'
  }
}
```

### 点击事件 (click)
```typescript
{
  eventName: 'click',
  properties: {
    element_type: 'button',
    element_id: 'login-btn',
    element_class: 'btn btn-primary',
    element_text: '登录',
    element_xpath: '/html/body/div[1]/button',
    element_selector: '#login-btn',
    click_x: 100,
    click_y: 200,
    page_x: 100,
    page_y: 200
  }
}
```

### 表单事件 (form_submit, form_field_change)
```typescript
// 表单提交
{
  eventName: 'form_submit',
  properties: {
    form_id: 'login-form',
    form_action: '/login',
    form_method: 'POST',
    form_fields: [
      { name: 'username', value: 'user123', type: 'text' },
      { name: 'password', value: '***', type: 'password' }
    ],
    form_validation: { isValid: true, errors: [] }
  }
}
```

### 性能事件 (page_performance)
```typescript
{
  eventName: 'page_performance',
  properties: {
    navigation_start: 0,
    dom_content_loaded: 1234.56,
    load_complete: 2345.67,
    first_paint: 567.89,
    first_contentful_paint: 890.12,
    largest_contentful_paint: 1200.34,
    first_input_delay: 45.67,
    cumulative_layout_shift: 0.123
  }
}
```

## 🔧 开发指南

### 本地开发
```bash
# 克隆项目
git clone https://github.com/ComfortableLiu/probe-x.git
cd probe-x/apps/web-sdk

# 安装依赖
npm install

# 开发模式
npm run dev

# 类型检查
npm run type-check

# 运行测试
npm test

# 构建
npm run build
```

### 构建产物
- `dist/probe-x-sdk.js` - UMD格式，用于浏览器
- `dist/probe-x-sdk.min.js` - UMD格式，压缩版本
- `dist/probe-x-sdk.esm.js` - ES模块格式
- `dist/probe-x-sdk.cjs.js` - CommonJS格式
- `dist/probe-x-sdk.d.ts` - TypeScript类型定义

### 自定义插件
```typescript
import type { Plugin } from '@probe-x/web-sdk';

class CustomPlugin implements Plugin {
  name = 'custom-plugin';
  version = '1.0.0';

  install(pluginManager: any, options?: any): void {
    // 插件初始化逻辑
    pluginManager.addHook('beforeTrack', (data: any) => {
      // 在事件发送前处理数据
      return data;
    });
  }

  uninstall(): void {
    // 插件清理逻辑
  }
}

// 使用插件
probeX.use(new CustomPlugin(), { option1: 'value1' });
```

## 🌐 浏览器兼容性

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+
- IE 11+ (需要polyfill)

### Polyfill
对于老版本浏览器，可能需要以下polyfill：
```html
<!-- Promise -->
<script src="https://cdn.jsdelivr.net/npm/es6-promise@4/dist/es6-promise.auto.min.js"></script>
<!-- Fetch -->
<script src="https://cdn.jsdelivr.net/npm/whatwg-fetch@3.6.2/dist/fetch.umd.js"></script>
<!-- URLSearchParams -->
<script src="https://cdn.jsdelivr.net/npm/url-search-params-polyfill@6.0.0/index.js"></script>
```

## 📈 性能优化

### 减少包体积
```typescript
// 按需导入
import { ProbeX, Utils } from '@probe-x/web-sdk';

// 或者使用tree-shaking
import ProbeX from '@probe-x/web-sdk/dist/probe-x-sdk.esm.js';
```

### 异步加载
```typescript
// 动态导入
const loadSDK = async () => {
  const { default: ProbeX } = await import('@probe-x/web-sdk');
  return new ProbeX(config);
};
```

### 采样配置
```typescript
const probeX = new ProbeX({
  sampling: 0.1, // 只采集10%的数据
  batchSize: 20,  // 增加批量大小
  flushInterval: 10000 // 增加发送间隔
});
```

## 🔒 隐私和安全

### 数据脱敏
```typescript
const probeX = new ProbeX({
  maskSensitiveData: true, // 自动脱敏敏感数据
  respectDNT: true,        // 尊重DNT设置
  anonymizeIP: true        // IP匿名化
});
```

### 自定义过滤
```typescript
const probeX = new ProbeX({
  blacklistUrls: ['/admin', /\/private\/.*/],
  blacklistEvents: ['sensitive_action'],
  whitelistUrls: ['/public']
});
```

## 🐛 故障排除

### 常见问题

1. **数据没有发送**
   - 检查`apiUrl`和`appId`配置
   - 启用`debug`模式查看日志
   - 检查网络连接和CORS设置

2. **自动埋点不工作**
   - 确认`autoTrack`配置为`true`
   - 检查URL过滤配置
   - 查看浏览器控制台错误

3. **TypeScript类型错误**
   - 确保安装了`@types/node`
   - 检查`tsconfig.json`配置
   - 更新到最新版本

### 调试模式
```typescript
const probeX = new ProbeX({
  debug: true // 启用详细日志
});

// 监听SDK事件
window.addEventListener('probe-x-event', (event) => {
  console.log('SDK Event:', event.detail);
});
```

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 🤝 贡献

欢迎提交Issue和Pull Request！

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开Pull Request

## 📞 支持

- 📧 邮箱: liuchengxu1994@gmail.com
- 🐛 问题: [GitHub Issues](https://github.com/ComfortableLiu/probe-x/issues)
- 📖 文档: [完整文档](https://github.com/ComfortableLiu/probe-x/blob/main/WEB_SDK_GUIDE.md)

## 🙏 致谢

感谢所有为这个项目做出贡献的开发者！