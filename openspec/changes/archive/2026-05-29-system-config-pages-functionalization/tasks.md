## 1. 共享类型定义

- [x] 1.1 在 libs/shared-types/src/lib/types/request/system-config.ts 中新增数据源相关类型（IDataSourceListItem, ICreateDataSourceReq, IUpdateDataSourceReq, IQueryDataSourceListReq 等）
- [x] 1.2 新增计算节点相关类型（IComputeNodeListItem, ICreateComputeNodeReq, IUpdateComputeNodeReq, IQueryComputeNodeListReq 等）
- [x] 1.3 新增通知配置相关类型（INotificationListItem, ICreateNotificationReq, IUpdateNotificationReq, IQueryNotificationListReq 等）

## 2. 后端 Entity 定义

- [x] 2.1 创建 DataSourceEntity（data_source 表）
- [x] 2.2 创建 ComputeNodeEntity（compute_node 表）
- [x] 2.3 创建 NotificationEntity（notification 表）

## 3. 后端 DataSourceModule

- [x] 3.1 创建 DataSourceService（CRUD + test-connection）
- [x] 3.2 创建 DataSourceController（路由定义）
- [x] 3.3 创建 DataSourceModule 并在 app.module.ts 注册

## 4. 后端 ComputeNodeModule

- [x] 4.1 创建 ComputeNodeService（CRUD）
- [x] 4.2 创建 ComputeNodeController（路由定义）
- [x] 4.3 创建 ComputeNodeModule 并在 app.module.ts 注册

## 5. 后端 NotificationModule

- [x] 5.1 创建 NotificationService（CRUD + test-send）
- [x] 5.2 创建 NotificationController（路由定义）
- [x] 5.3 创建 NotificationModule 并在 app.module.ts 注册

## 6. 前端数据源配置页

- [x] 6.1 补充 datasource/type.ts 类型定义
- [x] 6.2 创建 datasource/services.ts（API 调用）
- [x] 6.3 创建 datasource/model.ts（Rematch model）
- [x] 6.4 创建 datasource/components/EditPopup（新增/编辑弹窗）
- [x] 6.5 改造 datasource/index.tsx（接入 Redux store，实现完整 CRUD 交互）

## 7. 前端计算节点配置页

- [x] 7.1 补充 computing-node/type.ts 类型定义
- [x] 7.2 创建 computing-node/services.ts
- [x] 7.3 创建 computing-node/model.ts
- [x] 7.4 创建 computing-node/components/EditPopup
- [x] 7.5 改造 computing-node/index.tsx

## 8. 前端通知设置页

- [x] 8.1 补充 notification/type.ts 类型定义
- [x] 8.2 创建 notification/services.ts
- [x] 8.3 创建 notification/model.ts
- [x] 8.4 创建 notification/components/EditPopup
- [x] 8.5 改造 notification/index.tsx

## 9. 路由修复与 Model 注册

- [x] 9.1 取消 SystemConfig.tsx 中通知设置和日志配置路由的注释
- [x] 9.2 在 store/models/index.ts 中注册 3 个新 model

## 10. 验证

- [ ] 10.1 验证前端 TypeScript 编译通过
- [ ] 10.2 验证后端 TypeScript 编译通过
- [ ] 10.3 验证路由菜单正确显示通知设置和日志配置
- [ ] 10.4 验证三个页面的 CRUD 功能正常
