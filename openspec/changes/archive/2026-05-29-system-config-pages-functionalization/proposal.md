## Why

系统设置中的数据源配置、计算节点配置、通知设置三个页面目前是空壳页面——有表单和表格的 UI 骨架但没有数据绑定、CRUD 交互和后端 API。路由中通知设置和日志配置还被注释掉了，用户无法访问。需要将这三个页面功能化，补齐前后端完整链路，让系统设置模块真正可用。

## What Changes

### 前端改造（3 个页面）

1. **数据源配置页** — 从空表格改为完整 CRUD 页面：新增 services.ts、model.ts、components/EditPopup，改造 index.tsx 接入 Redux store，实现搜索/新增/编辑/删除/测试连接功能，补充 type.ts

2. **计算节点配置页** — 从空表格改为完整 CRUD 页面：新增 services.ts、model.ts、components/EditPopup，改造 index.tsx 接入 Redux store，实现搜索/新增/编辑/删除功能，补充 type.ts

3. **通知设置页** — 从空表格改为完整通知配置页面：新增 services.ts、model.ts、components/EditPopup，改造 index.tsx 接入 Redux store，实现搜索/新增/编辑/删除/测试发送功能，补充 type.ts

### 后端新增（3 个模块）

4. **DataSourceModule** — 新增 data-dashboard-api-service/src/api/datasource/：Entity (DataSourceEntity), Controller (list/create/update/delete/test-connection), Service

5. **ComputeNodeModule** — 新增 data-dashboard-api-service/src/api/compute-node/：Entity (ComputeNodeEntity), Controller (list/create/update/delete), Service

6. **NotificationModule** — 新增 data-dashboard-api-service/src/api/notification/：Entity (NotificationEntity), Controller (list/create/update/delete/test-send), Service

### 路由修复

7. 取消 SystemConfig.tsx 中通知设置和日志配置路由的注释。

### 共享类型

8. 在 libs/shared-types 中新增数据源、计算节点、通知相关的请求/响应类型定义。

## Capabilities

### New Capabilities
- `datasource-management`: 数据源配置管理 — 完整的 ClickHouse/MySQL 数据源连接配置 CRUD + 测试连接
- `compute-node-management`: 计算节点配置管理 — gRPC 计算节点注册配置的 CRUD
- `notification-management`: 通知设置管理 — Webhook/邮件通知规则的 CRUD + 测试发送

### Modified Capabilities
（无已有 spec 需要修改）

## Impact

- **前端新增**: datasource/computing-node/notification 各自的 services.ts, model.ts, components/EditPopup/
- **前端修改**: 3 个 index.tsx + type.ts, router/page/SystemConfig.tsx, store/models/index.ts
- **后端新增**: 3 个 NestJS Module（datasource, compute-node, notification）
- **后端修改**: app.module.ts 注册新模块
- **共享类型**: system-config.ts 新增类型
- **依赖**: 无需新增
- **数据库**: 需新建 3 张 MySQL 表
