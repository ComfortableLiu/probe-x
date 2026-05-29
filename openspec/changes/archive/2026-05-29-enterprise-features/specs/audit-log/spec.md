## Overview

操作审计日志能力，自动记录所有 API 写操作，支持按时间、用户、操作类型筛选查询。

## API

### GET /audit-log/list
查询审计日志列表（分页、支持按时间范围/用户名/操作类型筛选）

## Behavior

- AuditLogInterceptor 自动拦截 POST/PUT/DELETE 请求
- 异步写入日志，不阻塞主请求
- 记录用户ID、用户名、操作类型、请求路径、请求方法、请求体摘要、IP、响应状态码
- GET 请求不记录（避免查询噪音）
