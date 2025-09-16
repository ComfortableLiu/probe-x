# Probe-X Web SDK

Probe-X Web SDK 是一个轻量级的埋点数据收集SDK，专为Web应用设计。它提供了自动埋点、手动埋点、数据发送等功能，帮助开发者轻松收集用户行为数据。

## 特性

- 🚀 **轻量级**: 压缩后仅约 20KB
- 📊 **自动埋点**: 自动收集页面访问、点击、滚动、表单等事件
- 🎯 **手动埋点**: 支持自定义事件埋点
- 🔄 **批量发送**: 智能批量发送，减少网络请求
- 💾 **本地存储**: 支持多种存储方式，离线数据不丢失
- 🛡️ **错误处理**: 完善的错误处理和重试机制
- 📱 **跨平台**: 支持所有现代浏览器
- 🔧 **可配置**: 丰富的配置选项，满足不同需求

## 安装

### 方式一：CDN引入

```html
<script src="https://cdn.jsdelivr.net/npm/@probe-x/web-sdk@latest/dist/probe-x-sdk.min.js"></script>
```

### 方式二：NPM安装

```bash
npm install @probe-x/web-sdk
```

```javascript
import ProbeX from '@probe-x/web-sdk';
```

### 方式三：本地文件

下载 `probe-x-sdk.min.js` 文件到本地，然后引入：

```html
<script src="./probe-x-sdk.min.js"></script>
```

## 快速开始

### 基础使用

```javascript
// 初始化SDK
const probeX = new ProbeX({
  apiUrl: 'http://localhost:3000/data/beacon',
  appId: 'your-app-id',
  debug: true
});

// 手动埋点
probeX.track('button_click', {
  button_name: '登录按钮',
  page: 'login'
});

// 设置用户属性
probeX.setUser({
  user_id: '12345',
  user_name: '张三'
});
```

### 自动埋点

SDK会自动收集以下事件：

- **页面访问**: 页面加载、页面可见性变化
- **点击事件**: 所有元素的点击事件
- **滚动事件**: 页面滚动行为
- **表单事件**: 表单提交、字段变化
- **错误事件**: JavaScript错误、Promise错误
- **性能事件**: 页面加载性能数据
- **心跳事件**: 定期发送心跳数据

## 配置选项

```javascript
const probeX = new ProbeX({
  // 基础配置
  apiUrl: 'http://localhost:3000/data/beacon',  // API地址
  appId: 'your-app-id',                         // 应用ID
  debug: false,                                 // 调试模式
  
  // 自动埋点配置
  autoTrack: true,                              // 启用自动埋点
  autoTrackPageView: true,                      // 自动页面访问埋点
  autoTrackClick: true,                         // 自动点击埋点
  autoTrackScroll: true,                        // 自动滚动埋点
  autoTrackForm: true,                          // 自动表单埋点
  
  // 发送配置
  batchSize: 10,                                // 批量发送大小
  flushInterval: 5000,                          // 发送间隔(毫秒)
  maxRetries: 3,                                // 最大重试次数
  retryDelay: 1000,                             // 重试延迟(毫秒)
  
  // 存储配置
  storageType: 'localStorage',                  // 存储类型
  maxStorageSize: 1000,                         // 最大存储数量
  
  // 过滤配置
  blacklistUrls: ['/admin'],                    // 黑名单URL
  whitelistUrls: [],                            // 白名单URL
  blacklistEvents: ['heartbeat'],               // 黑名单事件
  whitelistEvents: [],                          // 白名单事件
  
  // 采样配置
  sampling: 1.0,                                // 采样率(0-1)
  
  // 用户配置
  userProperties: {},                           // 用户属性
  globalProperties: {},                         // 全局属性
  
  // 其他配置
  enableHeartbeat: true,                        // 启用心跳
  heartbeatInterval: 30000,                     // 心跳间隔(毫秒)
  enableErrorTracking: true,                    // 启用错误跟踪
  enablePerformanceTracking: true,              // 启用性能跟踪
});
```

## API 参考

### 构造函数

```javascript
new ProbeX(options)
```

创建ProbeX实例。

### 方法

#### track(eventName, properties, options)

手动埋点。

```javascript
probeX.track('custom_event', {
  property1: 'value1',
  property2: 'value2'
});
```

#### setUser(userProperties)

设置用户属性。

```javascript
probeX.setUser({
  user_id: '12345',
  user_name: '张三',
  user_type: 'premium'
});
```

#### setGlobalProperties(globalProperties)

设置全局属性。

```javascript
probeX.setGlobalProperties({
  app_version: '1.0.0',
  environment: 'production'
});
```

#### setConfig(key, value)

设置配置。

```javascript
probeX.setConfig('debug', true);
```

#### getConfig(key, defaultValue)

获取配置。

```javascript
const debug = probeX.getConfig('debug', false);
```

#### destroy()

销毁SDK实例。

```javascript
probeX.destroy();
```

## 事件类型

### 自动事件

| 事件名 | 描述 | 属性 |
|--------|------|------|
| `page_view` | 页面访问 | `page_title`, `page_url`, `page_path`, `referrer` |
| `click` | 点击事件 | `element_type`, `element_id`, `element_text`, `click_x`, `click_y` |
| `scroll` | 滚动事件 | `scroll_x`, `scroll_y`, `scroll_percentage` |
| `form_submit` | 表单提交 | `form_id`, `form_action`, `form_method`, `form_fields` |
| `form_field_change` | 表单字段变化 | `field_type`, `field_name`, `field_value` |
| `javascript_error` | JavaScript错误 | `error_message`, `error_filename`, `error_lineno` |
| `page_performance` | 页面性能 | `load_time`, `first_paint`, `first_contentful_paint` |
| `heartbeat` | 心跳事件 | `timestamp`, `page_visibility` |

### 自定义事件

你可以发送任何自定义事件：

```javascript
probeX.track('purchase', {
  product_id: 'prod_123',
  product_name: '商品名称',
  price: 99.99,
  currency: 'CNY',
  quantity: 1
});
```

## 数据格式

SDK发送的数据格式如下：

```javascript
{
  "eventName": "button_click",
  "ip": "192.168.1.1",
  "ua": "Mozilla/5.0...",
  "site": "example.com",
  "path": "/page",
  "params": "{\"button_name\":\"登录\"}",
  "deviceId": "device_123",
  "referrer": "https://google.com",
  "utmSource": "google",
  "utmMedium": "cpc",
  "utmCampaign": "summer_sale",
  "logTime": "2024-01-01T12:00:00.000Z",
  "serviceTime": "2024-01-01T12:00:00.000Z",
  "source": "web-sdk"
}
```

## 浏览器支持

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+
- IE 11+ (需要polyfill)

## 开发

### 构建

```bash
npm run build
```

### 开发模式

```bash
npm run dev
```

### 测试

```bash
npm test
```

### 代码检查

```bash
npm run lint
```

## 许可证

MIT License

## 贡献

欢迎提交Issue和Pull Request！

## 更新日志

### v1.0.0

- 初始版本发布
- 支持自动埋点和手动埋点
- 支持批量发送和本地存储
- 支持错误处理和重试机制
- 提供完整的TypeScript类型定义
