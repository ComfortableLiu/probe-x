## Architecture Decisions

### 1. 多租户项目隔离

- Project entity 作为一级实体，通过 UserProjectRelation 实现用户-项目多对多关系
- project_id 作为数据隔离的关键字段，在埋点接收和数据查询层面过滤
- 前端通过顶部项目切换器或项目管理页面管理项目

### 2. 操作审计日志

- 使用 NestJS Interceptor（AuditLogInterceptor）自动拦截所有写操作（POST/PUT/DELETE）
- AuditLog 记录：用户ID、用户名、操作类型、请求路径、请求方法、请求体、IP地址、响应状态
- 异步写入，不阻塞主请求

### 3. 异常告警系统

- AlertRule 存储告警规则配置（规则类型、阈值、关联项目等）
- AlertHistory 记录每次告警触发的历史
- 通过现有的 NotificationModule 发送告警通知
- 告警检查通过定时任务或事件驱动触发

## Data Model

### project 表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | bigint PK | 项目ID |
| project_name | varchar(100) | 项目名称 |
| project_key | varchar(50) | 项目标识（唯一） |
| description | varchar(500) | 描述 |
| is_enable | tinyint | 是否启用 |
| created_at | datetime | 创建时间 |
| updated_at | datetime | 更新时间 |

### user_project_relation 表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | bigint PK | 关系ID |
| user_id | bigint FK | 用户ID |
| project_id | bigint FK | 项目ID |
| created_at | datetime | 创建时间 |

### audit_log 表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | bigint PK | 日志ID |
| user_id | bigint | 操作用户ID |
| username | varchar(50) | 操作用户名 |
| action | varchar(50) | 操作类型 |
| method | varchar(10) | 请求方法 |
| path | varchar(500) | 请求路径 |
| request_body | text | 请求体 |
| response_status | int | 响应状态码 |
| ip | varchar(50) | IP地址 |
| user_agent | varchar(500) | User-Agent |
| created_at | datetime | 操作时间 |

### alert_rule 表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | bigint PK | 规则ID |
| rule_name | varchar(100) | 规则名称 |
| rule_type | varchar(50) | 规则类型 |
| condition | text | 规则条件（JSON） |
| project_id | bigint | 关联项目ID |
| notification_id | bigint FK | 通知配置ID |
| is_enable | tinyint | 是否启用 |
| description | varchar(500) | 描述 |
| created_at | datetime | 创建时间 |
| updated_at | datetime | 更新时间 |

### alert_history 表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | bigint PK | 历史ID |
| alert_rule_id | bigint FK | 告警规则ID |
| rule_name | varchar(100) | 规则名称（冗余） |
| alert_level | varchar(20) | 告警级别 |
| alert_content | text | 告警内容 |
| notify_status | varchar(20) | 通知状态 |
| created_at | datetime | 触发时间 |
