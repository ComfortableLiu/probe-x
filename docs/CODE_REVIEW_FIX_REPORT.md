# Probe-X 代码审查修复报告

**日期**: 2026-05-05
**审查范围**: 全部 7 个应用 + 2 个共享库
**修复范围**: P0 (Critical) + P1 (High) 共 17 项

---

## 一、P0 严重问题修复 (8 项)

### P0-1: 修复 createProperty SQL 注入

**文件**: `apps/data-dashboard-api-service/src/api/property/property.service.ts`

**问题**: `propertyName` 和 `comment` 直接拼接到 ClickHouse DDL 字符串，攻击者可通过注入删除/修改表结构。

**修复**:
- 添加 `propertyName` 正则校验，只允许字母、数字、下划线，且必须以字母或下划线开头
- 对 `comment` 中的单引号进行转义
- 校验 `propertyType` 是否在合法映射中
- 移除残留的 `console.log('llll----', ...)` 调试日志

---

### P0-2: 移除 noSignature 签名绕过

**文件**: `libs/shared-utils/src/lib/backend-common/interceptor/signature.interceptor.ts`

**问题**: 任何客户端可通过 `?noSignature=true` 查询参数跳过 HMAC 签名验证。

**修复**: 移除 `noSignature` 绕过逻辑（第 38-41 行），所有非白名单请求必须携带有效签名。

---

### P0-3: 限制 CORS 来源

**文件**: `apps/data-dashboard-api-service/src/main.ts`

**问题**: `origin: true` 允许所有来源的跨域请求，配合 `credentials: true` 可被任意网站利用。

**修复**:
- 改为从 `CORS_ORIGINS` 环境变量读取允许的来源列表（逗号分隔）
- 默认回退到 `http://localhost:{clientPort}`
- 生产环境需配置 `CORS_ORIGINS=https://your-domain.com`

---

### P0-4: 统一 JWT Secret 处理

**文件**:
- `apps/data-dashboard-api-service/src/app.module.ts`
- `apps/data-dashboard-api-service/src/api/user/JwtStrategy.ts`
- `apps/data-dashboard-api-service/src/service/auth.service.ts`

**问题**: JWT Secret 有三个不同的回退值（`'defaultSecret'`、`''`、`''`），导致签名和验证使用不同密钥。

**修复**: 三处统一改为：如果 `JWT_SECRET` 未配置，直接抛出异常阻止服务启动。确保所有代码路径使用同一个密钥。

---

### P0-5: 管理端点添加角色权限校验

**新文件**: `apps/data-dashboard-api-service/src/guard/admin.guard.ts`
**修改文件**: `system-config.controller.ts`, `system-config.module.ts`

**问题**: SystemConfigController 的所有管理接口（创建/删除用户、重置密码、分配角色等）仅依赖全局 SsoAuthGuard，无 RBAC 控制。

**修复**:
- 创建 `AdminGuard`，查询用户角色，校验是否拥有 `admin` 角色或 `isSystemRole` 标记
- 在 `SystemConfigController` 上添加 `@UseGuards(AdminGuard)`
- 在 `SystemConfigModule` 中注册 `AdminGuard`

---

### P0-6: 移除前端签名密钥暴露

**文件**:
- `apps/frontend/src/lib/request/request.ts`
- `apps/frontend/config/configuration.ts`
- `apps/data-dashboard-api-service/src/app.module.ts`

**问题**: HMAC 签名密钥通过 `process.env.SIGNATURE_SECRET` 打包进客户端 JS，任何用户可通过 DevTools 提取并伪造请求。

**修复**:
- 移除前端请求拦截器中的签名生成逻辑和 `SECRET_KEY` 常量
- 移除前端配置中的 `signatureSecret` 字段
- 移除后端的 `SignatureInterceptor` 全局注册（HMAC 签名在客户端持有密钥时无安全意义）
- 注释说明后续应使用服务端签名方案

---

### P0-7: 修复 SDK 原型链污染

**文件**:
- `apps/web-sdk/src/config.ts` - `ConfigManager.set()`
- `apps/web-sdk/src/utils.ts` - `Utils.safeSet()`

**问题**: `set()` 方法未校验 `__proto__`、`constructor`、`prototype` 键名，攻击者可通过 `sdk.setConfig('__proto__.polluted', true)` 污染全局对象原型。

**修复**: 在两个方法中添加 `DANGEROUS_KEYS` 黑名单检查，遇到危险键名直接 return。

---

### P0-8: 修复 Kafka 消息丢失

**文件**:
- `apps/receiving-point-service/src/api/point/point.service.ts`
- `apps/preliminary-data-processing-service/src/module/kafka-consumer/kafka-consumer.controller.ts`

**问题**:
1. `saveSingleEvent` 中 Kafka emit 是 fire-and-forget，`return true` 在 Promise 结束前返回
2. `handleUserAction` 未 return/await `handleEvent` 的 Promise，异常无法被捕获

**修复**:
1. `saveSingleEvent` 改为 `async`，`await firstValueFrom(kafkaClient.emit(...))`
2. `handleUserAction` 改为 `async`，`return await this.kafkaConsumerService.handleEvent(event)`

---

## 二、P1 高危问题修复 (9 项)

### P1-1: 修复 paramIndex 并发问题

**文件**:
- `EventAnalysisSqlBuilder.ts`
- `FunnelAnalysisSqlBuilder.ts`
- `UserPathAnalysisSqlBuilder.ts`

**问题**: 三个 SQL Builder 使用模块级 `let paramIndex = 0`，并发请求共享此计数器导致参数名冲突和查询结果错误。

**修复**: 参照 `AttributionAnalysisSqlBuilder.ts` 的模式，将 `paramIndex` 改为 per-request 的 `indexRef: { value: number }` 对象，所有函数通过参数传递 `indexRef`。

---

### P1-2: 添加登录速率限制

**新文件**: `apps/data-dashboard-api-service/src/guard/throttle.guard.ts`
**修改文件**: `apps/data-dashboard-api-service/src/api/user/user.controller.ts`

**问题**: 登录端点无速率限制，可被暴力破解。

**修复**:
- 创建 `LoginThrottleGuard`，基于 IP 地址限制 15 分钟内最多 5 次登录尝试
- 超过限制返回 HTTP 429
- 包含自动清理机制防止内存泄漏
- 应用到 `POST /api/user/login` 端点

---

### P1-3: 修复密码哈希一致性

**文件**: `apps/data-dashboard-api-service/src/api/system-config/user.service.ts`

**问题**: `resetPassword` 对密码哈希一次，而 `changePassword` 哈希两次（模拟前端+后端），导致管理员重置密码后用户无法登录。

**修复**: `resetPassword` 改为与 `changePassword` 一致的双重哈希：
```typescript
const frontendEncrypted = this.hashPassword(newPassword)
user.passwordHash = this.hashPassword(frontendEncrypted)
```

---

### P1-4: 添加 Error Boundary

**新文件**: `apps/frontend/src/components/ErrorBoundary/index.tsx`
**修改文件**: `apps/frontend/src/layout/App.tsx`

**问题**: 整个前端无 Error Boundary，任何组件运行时错误导致白屏。

**修复**:
- 创建 `ErrorBoundary` 组件，捕获子组件错误并显示友好的错误页面
- 包含"重试"按钮重置错误状态
- 在 `App` 组件最外层包裹 `ErrorBoundary`

---

### P1-5: 修复 SDK localStorage 未保护访问

**文件**:
- `apps/web-sdk/src/index.ts` - `generateSessionId()`, `getOrCreateDeviceId()`
- `apps/web-sdk/src/session-manager.ts` - 6 个方法

**问题**: 多处直接访问 `localStorage` 未 try-catch，Safari 隐私模式会抛异常，SSR 环境直接崩溃。

**修复**: 为所有 localStorage 访问添加 try-catch：
- 读取失败时回退到内存（如 `uuidv4()`）
- 写入失败时静默忽略
- `session-manager.ts` 的 `getOrCreateSessionId`、`getSessionStartTime`、`loadSessionData`、`saveSessionData`、`resetSessionData`、`updateLastActivity`、`expireSession`、`end` 方法均已保护

---

### P1-6: 修复 TrackingNode JoinColumn

**文件**: `libs/shared-utils/src/lib/backend-common/entity/TrackingNode.entity.ts`

**问题**: `@JoinColumn({ name: 'parentId' })` 但实际列名是 `parentCode`，TypeORM 查找不存在的列导致自引用关系失败。

**修复**: 改为 `@JoinColumn({ name: 'parentCode', referencedColumnName: 'code' })`

---

### P1-7: 修复 usePathPermission Hook

**文件**: `apps/frontend/src/hooks/usePermission.ts`

**问题**: `usePathPermission` 引用未定义的 `app` 变量（`useApp()` 被注释掉），运行时必崩 `ReferenceError`。

**修复**:
- 改为从 `store.getState().userModel` 直接获取 `permissionInfo`
- 修复 `validatePermissionByPathname` 中的空值保护（`roleRouterMap[path]?.includes`）
- 移除无用的 `useApp` 注释导入

---

### P1-8: 修复 JSON.parse 未保护

**文件**: `apps/frontend/src/utils/storage.ts`

**问题**: `localStorage.getItem()` 返回 `null` 时 `JSON.parse(null)` 返回 `null`，但返回非 JSON 字符串时 `JSON.parse` 抛异常。

**修复**: 为 `Localstorage.get`、`Localstorage.set`、`Localstorage.remove` 和对应的 `SessionStorage` 方法全部添加 try-catch，并检查 `typeof localStorage !== 'undefined'` 防止 SSR 报错。

---

### P1-9: 修复硬编码管理员判断

**文件**:
- `apps/frontend/src/store/models/app/model.ts`
- `apps/data-dashboard-api-service/src/api/user/user.controller.ts`

**问题**: 前端 `userId !== 1` 和后端 `userId === 1` 硬编码管理员判断，用户重建后失效。

**修复**:
- 前端改为 `userInfo.roles?.some(role => role.roleKey === 'admin' || role.isSystemRole)`
- 后端新增 `getUserRoles()` 方法，查询用户实际角色
- `rolePermissionList` 端点改为基于角色判断是否为管理员

---

## 三、新增文件清单

| 文件路径 | 用途 |
|---------|------|
| `apps/data-dashboard-api-service/src/guard/admin.guard.ts` | 管理员角色权限守卫 |
| `apps/data-dashboard-api-service/src/guard/throttle.guard.ts` | 登录速率限制守卫 |
| `apps/frontend/src/components/ErrorBoundary/index.tsx` | React 错误边界组件 |

## 四、修改文件清单

| 文件路径 | 修改类型 |
|---------|---------|
| `apps/data-dashboard-api-service/src/api/property/property.service.ts` | SQL 注入修复 |
| `libs/shared-utils/src/lib/backend-common/interceptor/signature.interceptor.ts` | 移除绕过后门 |
| `apps/data-dashboard-api-service/src/main.ts` | CORS 限制 |
| `apps/data-dashboard-api-service/src/app.module.ts` | JWT Secret + 移除签名拦截器 |
| `apps/data-dashboard-api-service/src/api/user/JwtStrategy.ts` | JWT Secret |
| `apps/data-dashboard-api-service/src/service/auth.service.ts` | JWT Secret |
| `apps/data-dashboard-api-service/src/api/system-config/system-config.controller.ts` | 添加 AdminGuard |
| `apps/data-dashboard-api-service/src/api/system-config/system-config.module.ts` | 注册 AdminGuard |
| `apps/data-dashboard-api-service/src/api/system-config/user.service.ts` | 密码哈希一致性 |
| `apps/data-dashboard-api-service/src/api/user/user.controller.ts` | 限流 + 角色判断 |
| `apps/data-dashboard-api-service/src/api/user/user.service.ts` | 新增 getUserRoles |
| `apps/data-dashboard-api-service/src/api/data-analysis/EventAnalysisSqlBuilder.ts` | paramIndex 并发修复 |
| `apps/data-dashboard-api-service/src/api/data-analysis/FunnelAnalysisSqlBuilder.ts` | paramIndex 并发修复 |
| `apps/data-dashboard-api-service/src/api/data-analysis/UserPathAnalysisSqlBuilder.ts` | paramIndex 并发修复 |
| `apps/receiving-point-service/src/api/point/point.service.ts` | Kafka await |
| `apps/preliminary-data-processing-service/src/module/kafka-consumer/kafka-consumer.controller.ts` | Kafka return Promise |
| `apps/frontend/src/lib/request/request.ts` | 移除签名逻辑 |
| `apps/frontend/config/configuration.ts` | 移除签名密钥 |
| `apps/frontend/src/layout/App.tsx` | 添加 ErrorBoundary |
| `apps/frontend/src/store/models/app/model.ts` | 角色判断 |
| `apps/frontend/src/hooks/usePermission.ts` | 修复 Hook |
| `apps/frontend/src/utils/storage.ts` | JSON.parse 保护 |
| `apps/web-sdk/src/config.ts` | 原型链污染修复 |
| `apps/web-sdk/src/utils.ts` | 原型链污染修复 |
| `apps/web-sdk/src/index.ts` | localStorage 保护 |
| `apps/web-sdk/src/session-manager.ts` | localStorage 保护 |
| `libs/shared-utils/src/lib/backend-common/entity/TrackingNode.entity.ts` | JoinColumn 修复 |

## 五、待配置的环境变量

| 变量名 | 用途 | 是否必填 |
|--------|------|---------|
| `JWT_SECRET` | JWT 签名密钥 | **必填**（未配置服务无法启动） |
| `CORS_ORIGINS` | 允许的跨域来源（逗号分隔） | 可选（默认 localhost） |

## 六、后续建议

1. **P2 问题**: SQL Builder 重复代码提取、ECharts tree-shaking、死代码清理
2. **安全加固**: Token 存储改为 httpOnly Cookie、ClickHouse 查询超时、请求体大小限制
3. **可观测性**: 替换 console.log 为结构化日志（如 pino/winston）
4. **测试**: 为安全相关的修复添加单元测试（SQL 注入防护、原型链污染、速率限制）
