# Probe-X Web SDK 使用指南

## 📖 概述

Probe-X Web SDK 是一个轻量级的埋点数据收集SDK，专为Web应用设计。它提供了自动埋点、手动埋点、数据发送等功能，帮助开发者轻松收集用户行为数据。

## 🚀 快速开始

### 安装

#### 方式一：CDN引入
```html
<script src="https://cdn.jsdelivr.net/npm/@probe-x/web-sdk@latest/dist/probe-x-sdk.min.js"></script>
```

#### 方式二：NPM安装
```bash
npm install @probe-x/web-sdk
```

```javascript
import ProbeX from '@probe-x/web-sdk';
```

#### 方式三：本地文件
下载 `probe-x-sdk.min.js` 文件到本地，然后引入：
```html
<script src="./probe-x-sdk.min.js"></script>
```

### 基础使用

```javascript
// 初始化SDK
const probeX = new ProbeX({
  apiUrl: 'http://localhost:3004/point/report',
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

## ⚙️ 配置选项

### 基础配置
```javascript
const probeX = new ProbeX({
  // 必需配置
  apiUrl: 'http://localhost:3004/point/report',  // API地址
  appId: 'your-app-id',                         // 应用ID
  
  // 可选配置
  debug: false,                                 // 调试模式
});
```

### 自动埋点配置
```javascript
const probeX = new ProbeX({
  // 自动埋点开关
  autoTrack: true,                              // 启用自动埋点
  autoTrackPageView: true,                      // 自动页面访问埋点
  autoTrackClick: true,                         // 自动点击埋点
  autoTrackScroll: true,                        // 自动滚动埋点
  autoTrackForm: true,                          // 自动表单埋点
});
```

### 发送配置
```javascript
const probeX = new ProbeX({
  // 批量发送配置
  batchSize: 10,                                // 批量发送大小
  flushInterval: 5000,                          // 发送间隔(毫秒)
  maxRetries: 3,                                // 最大重试次数
  retryDelay: 1000,                             // 重试延迟(毫秒)
});
```

### 存储配置
```javascript
const probeX = new ProbeX({
  // 存储配置
  storageType: 'localStorage',                  // 存储类型: localStorage, sessionStorage, memory
  maxStorageSize: 1000,                         // 最大存储数量
});
```

### 过滤配置
```javascript
const probeX = new ProbeX({
  // URL过滤
  blacklistUrls: ['/admin', '/test'],           // 黑名单URL
  whitelistUrls: [],                            // 白名单URL
  
  // 事件过滤
  blacklistEvents: ['heartbeat'],               // 黑名单事件
  whitelistEvents: [],                          // 白名单事件
});
```

### 采样配置
```javascript
const probeX = new ProbeX({
  // 采样配置
  sampling: 1.0,                                // 采样率(0-1)
});
```

### 用户和全局属性
```javascript
const probeX = new ProbeX({
  // 用户属性
  userProperties: {
    user_id: '12345',
    user_type: 'premium'
  },
  
  // 全局属性
  globalProperties: {
    app_version: '1.0.0',
    environment: 'production'
  },
});
```

### 其他配置
```javascript
const probeX = new ProbeX({
  // 功能开关
  enableHeartbeat: true,                        // 启用心跳
  heartbeatInterval: 30000,                     // 心跳间隔(毫秒)
  enableErrorTracking: true,                    // 启用错误跟踪
  enablePerformanceTracking: true,              // 启用性能跟踪
});
```

## 📊 自动埋点事件

### 页面访问事件 (page_view)
```javascript
{
  eventName: 'page_view',
  properties: {
    page_title: '页面标题',
    page_url: 'https://example.com/page',
    page_path: '/page',
    referrer: 'https://google.com',
    load_time: 1234.56
  }
}
```

### 点击事件 (click)
```javascript
{
  eventName: 'click',
  properties: {
    element_type: 'button',
    element_id: 'login-btn',
    element_class: 'btn btn-primary',
    element_text: '登录',
    element_href: null,
    click_x: 100,
    click_y: 200,
    page_x: 100,
    page_y: 200,
    button: 0,
    ctrl_key: false,
    shift_key: false,
    alt_key: false,
    meta_key: false
  }
}
```

### 滚动事件 (scroll)
```javascript
{
  eventName: 'scroll',
  properties: {
    scroll_x: 0,
    scroll_y: 100,
    scroll_percentage: 25,
    viewport_width: 1920,
    viewport_height: 1080,
    document_width: 1920,
    document_height: 4000
  }
}
```

### 表单事件 (form_submit, form_field_change)
```javascript
// 表单提交
{
  eventName: 'form_submit',
  properties: {
    form_id: 'login-form',
    form_class: 'form',
    form_action: '/login',
    form_method: 'POST',
    form_fields: [
      { name: 'username', value: 'user123' },
      { name: 'password', value: '***' }
    ]
  }
}

// 表单字段变化
{
  eventName: 'form_field_change',
  properties: {
    field_type: 'text',
    field_name: 'username',
    field_id: 'username-input',
    field_class: 'form-control',
    field_value: 'user123',
    field_placeholder: '请输入用户名',
    form_id: 'login-form'
  }
}
```

### 错误事件 (javascript_error)
```javascript
{
  eventName: 'javascript_error',
  properties: {
    error_message: 'Cannot read property of undefined',
    error_filename: 'https://example.com/app.js',
    error_lineno: 123,
    error_colno: 45,
    error_stack: 'Error: Cannot read property...'
  }
}
```

### 性能事件 (page_performance)
```javascript
{
  eventName: 'page_performance',
  properties: {
    navigation_start: 1234567890,
    dom_content_loaded: 1234.56,
    load_complete: 2345.67,
    first_paint: 567.89,
    first_contentful_paint: 890.12,
    connection_type: '4g',
    connection_downlink: 10.5,
    connection_rtt: 50
  }
}
```

### 心跳事件 (heartbeat)
```javascript
{
  eventName: 'heartbeat',
  properties: {
    timestamp: 1234567890,
    page_visibility: 'visible',
    user_agent: 'Mozilla/5.0...',
    language: 'zh-CN',
    timezone: 'Asia/Shanghai'
  }
}
```

## 🎯 手动埋点

### 基础埋点
```javascript
// 简单事件
probeX.track('button_click');

// 带属性的事件
probeX.track('button_click', {
  button_name: '登录按钮',
  page: 'login',
  user_type: 'premium'
});

// 带选项的事件
probeX.track('button_click', {
  button_name: '登录按钮'
}, {
  immediate: true,  // 立即发送
  priority: 'high'  // 高优先级
});
```

### 业务事件示例
```javascript
// 用户注册
probeX.track('user_register', {
  user_id: '12345',
  register_method: 'email',
  source: 'landing_page'
});

// 商品购买
probeX.track('purchase', {
  product_id: 'prod_123',
  product_name: '商品名称',
  price: 99.99,
  currency: 'CNY',
  quantity: 1,
  order_id: 'order_12345'
});

// 页面停留
probeX.track('page_stay', {
  page: 'product_detail',
  stay_time: 30000,  // 30秒
  scroll_depth: 80   // 80%滚动深度
});
```

## 👤 用户管理

### 设置用户属性
```javascript
// 设置用户属性
probeX.setUser({
  user_id: '12345',
  user_name: '张三',
  user_type: 'premium',
  registration_date: '2024-01-01',
  last_login: '2024-01-15'
});

// 更新用户属性
probeX.setUser({
  last_login: '2024-01-16',
  login_count: 10
});
```

### 设置全局属性
```javascript
// 设置全局属性
probeX.setGlobalProperties({
  app_version: '1.0.0',
  environment: 'production',
  feature_flags: {
    new_ui: true,
    beta_feature: false
  }
});
```

## 🔧 配置管理

### 动态配置
```javascript
// 设置配置
probeX.setConfig('debug', true);
probeX.setConfig('sampling', 0.5);

// 获取配置
const debug = probeX.getConfig('debug', false);
const sampling = probeX.getConfig('sampling', 1.0);
```

## 📱 浏览器兼容性

### 支持的浏览器
- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+
- IE 11+ (需要polyfill)

### Polyfill支持
对于IE 11等老版本浏览器，需要添加以下polyfill：

```html
<!-- Promise polyfill -->
<script src="https://cdn.jsdelivr.net/npm/es6-promise@4/dist/es6-promise.auto.min.js"></script>

<!-- Fetch polyfill -->
<script src="https://cdn.jsdelivr.net/npm/whatwg-fetch@3.6.2/dist/fetch.umd.js"></script>

<!-- URLSearchParams polyfill -->
<script src="https://cdn.jsdelivr.net/npm/url-search-params-polyfill@6.0.0/index.js"></script>
```

## 🛠️ 开发调试

### 调试模式
```javascript
const probeX = new ProbeX({
  debug: true,  // 启用调试模式
  // ... 其他配置
});
```

调试模式下，SDK会在控制台输出详细信息：
- 事件收集日志
- 数据发送日志
- 错误信息
- 配置信息

### 事件监听
```javascript
// 监听SDK事件
window.addEventListener('probe-x-event', function(event) {
  console.log('SDK Event:', event.detail);
});
```

### 手动测试
```javascript
// 测试数据发送
probeX.track('test_event', {
  test_property: 'test_value'
});

// 查看队列状态
console.log('Queue length:', probeX.sender.getQueueLength());

// 手动刷新
probeX.sender.flush();
```

## 📦 构建和部署

### 本地构建
```bash
# 进入SDK目录
cd apps/web-sdk

# 安装依赖
npm install

# 构建
npm run build

# 开发模式
npm run dev
```

### 构建产物
构建完成后，会在 `dist` 目录生成以下文件：
- `probe-x-sdk.js` - UMD格式，用于浏览器
- `probe-x-sdk.min.js` - UMD格式，压缩版本
- `probe-x-sdk.esm.js` - ES模块格式
- `probe-x-sdk.cjs.js` - CommonJS格式
- `probe-x-sdk.d.ts` - TypeScript类型定义

### 部署到CDN
```bash
# 发布到NPM
npm publish

# 或者部署到自己的CDN
# 将dist目录下的文件上传到CDN服务器
```

## 🔍 故障排除

### 常见问题

#### 1. 数据没有发送
- 检查 `apiUrl` 配置是否正确
- 检查 `appId` 是否设置
- 检查网络连接
- 启用调试模式查看错误信息

#### 2. 自动埋点不工作
- 检查 `autoTrack` 配置是否为 `true`
- 检查具体的事件类型是否启用
- 检查URL过滤配置

#### 3. 存储问题
- 检查浏览器是否支持localStorage
- 检查存储空间是否充足
- 尝试切换到memory存储模式

#### 4. 性能问题
- 调整 `batchSize` 和 `flushInterval`
- 降低 `sampling` 采样率
- 禁用不必要的自动埋点

### 调试技巧
```javascript
// 1. 启用调试模式
const probeX = new ProbeX({
  debug: true,
  // ... 其他配置
});

// 2. 监听所有事件
window.addEventListener('probe-x-event', function(event) {
  console.log('Event:', event.detail);
});

// 3. 检查配置
console.log('Config:', probeX.config.getAll());

// 4. 检查队列状态
console.log('Queue:', probeX.sender.getQueueLength());

// 5. 手动发送
probeX.sender.flush();
```

## 📚 更多资源

- [GitHub仓库](https://github.com/ComfortableLiu/probe-x)
- [在线示例](https://example.com/demo)
- [API文档](./API.md)
- [更新日志](./CHANGELOG.md)

## 🤝 贡献

欢迎提交Issue和Pull Request！

## 📄 许可证

MIT License
