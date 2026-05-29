## Context

系统设置模块位于 `apps/frontend/src/pages/system-config/`，采用 Rematch (Redux) 状态管理。当前状态：

- **用户管理/角色管理/系统管理** 已完整实现：有 services.ts、model.ts、components/EditPopup，通过 Redux store 管理数据
- **数据源配置/计算节点配置/通知设置** 是空壳页面：有 UI 骨架（FormComponent + TableComponent）但 dataSource=[]，操作按钮无绑定
- 后端 `SystemConfigController` 已有 user/role/system 三组 CRUD 接口，使用 TypeORM + MySQL
- 路由 `SystemConfig.tsx` 中通知设置和日志配置被注释掉

数据流模式（以用户管理为例）：URL query params → FormComponent 筛选 → dispatch.getUserList() → services.queryUserList() → API → updateItem({ userList }) → Redux store → TableComponent 消费。

## Goals / Non-Goals

**Goals:**
- 数据源配置页实现完整 CRUD + 测试连接
- 计算节点配置页实现完整 CRUD
- 通知设置页实现完整 CRUD + 测试发送
- 后端新增 3 个独立 NestJS Module（DataSourceModule、ComputeNodeModule、NotificationModule）
- 共享类型定义补齐
- 取消路由注释

**Non-Goals:**
- 不修改已有的 user/role/system 管理功能
- 不修改 TableComponent/FormComponent 等公共组件
- 不实现数据源连接池或实际连接测试逻辑（仅预留接口）
- 不实现通知实际发送逻辑（仅预留接口）

## Decisions

### 1. 后端架构：3 个独立 Module 而非扩展 SystemConfigController

**选择**: 新增 DataSourceModule、ComputeNodeModule、NotificationModule，各自有独立的 controller/service/entity。

**理由**:
- SystemConfigController 已经有 280+ 行代码，继续膨胀会降低可维护性
- 数据源/计算节点/通知是独立领域，各自有不同的业务逻辑
- 独立 Module 便于后续拆分为独立微服务

**替代方案**: 将新接口全部加到 SystemConfigController — 拒绝，controller 已过大。

### 2. API 路径风格：/api/datasource/* 而非 /system-config/datasource/*

**选择**: 新模块使用独立的 API 前缀路径（/api/datasource、/api/compute-node、/api/notification），不嵌套在 /system-config 下。

**理由**:
- 数据源和计算节点可能被其他模块引用（如数据处理服务查询数据源配置）
- 独立路径更清晰，符合 RESTful 风格
- 前端 services.ts 直接使用新路径

### 3. Entity 设计：使用与现有实体一致的 TypeORM 模式

**选择**: 每个 Entity 使用 @PrimaryGeneratedColumn、@Column、@CreateDateColumn、@UpdateDateColumn 装饰器，与 System.entity.ts 等保持一致。

### 4. 前端状态管理：每个页面独立 Rematch Model

**选择**: 每个页面创建独立的 Rematch model（datasourceModel、computeNodeModel、notificationModel），与其他系统配置页面一致。

### 5. EditPopup 组件：Modal + Form 模式

**选择**: 复用现有的 Modal + Form.useForm 模式，与 UserEditPopup 保持一致。

## Risks / Trade-offs

- **[风险] 数据库迁移** → 需要新建 3 张表。缓解：提供 SQL 建表语句
- **[权衡] 测试连接/测试发送为预留接口** → 当前不实现实际连接逻辑，返回模拟成功结果，后续迭代补充
- **[权衡] 独立 Module vs 扩展 SystemConfigController** → 增加了文件数量但提高了可维护性
