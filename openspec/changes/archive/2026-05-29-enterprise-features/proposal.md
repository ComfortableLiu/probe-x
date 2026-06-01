## Why

Probe-X 当前缺乏企业级多租户隔离、操作审计和异常告警能力。在多团队共用一个实例的场景下，无法区分不同项目的数据边界；没有操作审计日志意味着安全合规缺失；没有告警系统意味着数据异常无法及时发现。这三个特性是 Probe-X 从工具级产品升级为企业级产品的关键。

## What Changes

### 1. 多租户/项目隔离

- **后端**: 新增 Project entity + ProjectModule（controller+service），支持项目 CRUD
- **后端**: 新增 UserProjectRelation entity，实现用户与项目的多对多关联
- **后端**: 在接收服务和查询 API 中加入 project_id 过滤
- **前端**: 系统配置下新增项目管理页面（CRUD + 成员管理）

### 2. 操作审计日志

- **后端**: 新增 AuditLog entity + AuditLogModule
- **后端**: 通过 NestJS AuditLogInterceptor 自动记录所有写操作
- **前端**: 系统配置下新增审计日志查看页面（支持按时间/用户/操作类型筛选）

### 3. 异常告警系统

- **后端**: 新增 AlertRule entity + AlertHistory entity + AlertModule
- **后端**: 支持配置告警规则（事件量异常波动、转化率下降等）
- **后端**: 告警触发时通过 NotificationModule 发送通知
- **前端**: 系统配置下新增告警规则配置页面 + 告警历史查看页面

## Capabilities

### New Capabilities
- `multi-tenant-project-isolation`: 多租户项目隔离 — 项目管理、用户-项目关联、数据按项目隔离
- `audit-log`: 操作审计日志 — 自动记录 API 操作日志，支持查询筛选
- `alert-system`: 异常告警系统 — 告警规则配置、告警触发与通知、告警历史

### Modified Capabilities
（无已有 spec 需要修改）

## Impact

- **前端新增**: system-config/project, system-config/audit-log, system-config/alert 各自的页面组件
- **前端修改**: router/page/SystemConfig.tsx, store/models/index.ts
- **后端新增**: ProjectModule, AuditLogModule, AlertModule
- **后端修改**: app.module.ts 注册新模块, receiving-point-service 加入 project_id
- **共享类型**: 新增 project/audit-log/alert 相关类型
- **数据库**: 需新建 project, user_project_relation, audit_log, alert_rule, alert_history 5 张表
