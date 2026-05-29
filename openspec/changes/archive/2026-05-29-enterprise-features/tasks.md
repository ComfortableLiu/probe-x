## 1. 共享类型定义

- [ ] 1.1 在 libs/shared-types 中新增项目管理相关类型（IProjectListItem, ICreateProjectReq 等）
- [ ] 1.2 新增审计日志相关类型（IAuditLogListItem, IQueryAuditLogListReq 等）
- [ ] 1.3 新增告警系统相关类型（IAlertRuleListItem, IAlertHistoryListItem 等）

## 2. 后端 Entity 定义

- [ ] 2.1 创建 ProjectEntity（project 表）
- [ ] 2.2 创建 UserProjectRelationEntity（user_project_relation 表）
- [ ] 2.3 创建 AuditLogEntity（audit_log 表）
- [ ] 2.4 创建 AlertRuleEntity（alert_rule 表）
- [ ] 2.5 创建 AlertHistoryEntity（alert_history 表）

## 3. 后端 ProjectModule

- [ ] 3.1 创建 ProjectService（CRUD + 成员管理）
- [ ] 3.2 创建 ProjectController（路由定义）
- [ ] 3.3 创建 ProjectModule 并在 app.module.ts 注册

## 4. 后端 AuditLogModule

- [ ] 4.1 创建 AuditLogService（查询 + 记录）
- [ ] 4.2 创建 AuditLogController（查询路由）
- [ ] 4.3 创建 AuditLogInterceptor（自动拦截写操作）
- [ ] 4.4 创建 AuditLogModule 并在 app.module.ts 注册

## 5. 后端 AlertModule

- [ ] 5.1 创建 AlertService（规则 CRUD + 告警触发 + 通知发送）
- [ ] 5.2 创建 AlertController（规则和历史查询路由）
- [ ] 5.3 创建 AlertModule 并在 app.module.ts 注册

## 6. 前端项目管理页

- [ ] 6.1 创建 project/type.ts, services.ts, model.ts
- [ ] 6.2 创建 project/components/EditPopup
- [ ] 6.3 创建 project/index.tsx

## 7. 前端审计日志页

- [ ] 7.1 创建 audit-log/type.ts, services.ts, model.ts
- [ ] 7.2 创建 audit-log/index.tsx

## 8. 前端告警系统页

- [ ] 8.1 创建 alert/type.ts, services.ts, model.ts
- [ ] 8.2 创建 alert/components/RuleEditPopup
- [ ] 8.3 创建 alert/index.tsx（规则管理 + 告警历史 Tab）

## 9. 路由与 Model 注册

- [ ] 9.1 在 SystemConfig.tsx 中添加项目管理、审计日志、告警管理路由
- [ ] 9.2 在 store/models/index.ts 中注册 3 个新 model

## 10. 验证

- [ ] 10.1 验证前端 TypeScript 编译通过
- [ ] 10.2 验证后端 TypeScript 编译通过
- [ ] 10.3 验证各页面功能正常
