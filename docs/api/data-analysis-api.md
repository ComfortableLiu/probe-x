# Probe-X 数据分析 API 文档

## 概述

本文档描述了 Probe-X 数据分析模块的 API 接口，包括留存分析和用户分群功能。

**Base URL**: `http://localhost:8101/api`

**认证方式**: JWT Token（通过 Header 传递）

---

## 📊 留存分析 API

### 1. 查询留存数据

**接口**: `POST /data-analysis/retention/query`

**描述**: 查询用户留存分析数据，支持按日/周/月计算留存率。

**请求参数**:

```typescript
interface IRetentionAnalysisReq {
  // 事件名称
  eventName: string;
  
  // 留存事件名称（可选，默认与 eventName 相同）
  retentionEventName?: string;
  
  // 时间范围
  startDate: string;  // YYYY-MM-DD
  endDate: string;    // YYYY-MM-DD
  
  // 留存粒度：day | week | month
  granularity: 'day' | 'week' | 'month';
  
  // 留存窗口（天数）
  retentionWindow: number;
  
  // 分组维度（可选）
  groupBy?: string;
  
  // 筛选条件（可选）
  filters?: Record<string, any>;
}
```

**响应**:

```typescript
interface IRetentionAnalysisRes {
  // 队列数据
  cohorts: Array<{
    // 队列日期
    cohortDate: string;
    // 初始用户数
    initialUsers: number;
    // 留存用户数
    retainedUsers: number[];
    // 留存率
    retentionRates: number[];
  }>;
  
  // 汇总信息
  summary: {
    totalUsers: number;
    avgRetentionRate: number;
  };
}
```

**示例请求**:

```json
{
  "eventName": "page_view",
  "startDate": "2024-01-01",
  "endDate": "2024-01-31",
  "granularity": "day",
  "retentionWindow": 7
}
```

---

### 2. 创建留存数据下载任务

**接口**: `POST /data-analysis/retention/download`

**描述**: 创建留存分析数据的下载任务。

**请求参数**: 与查询接口相同（`IRetentionAnalysisReq`）

**响应**:

```typescript
interface ISubmitDownloadTaskRes {
  // 任务ID
  taskId: string;
  // 任务状态
  status: 'pending' | 'processing' | 'completed' | 'failed';
}
```

---

### 3. 查询下载任务进度

**接口**: `POST /data-analysis/retention/download/task`

**描述**: 查询下载任务的进度和结果。

**请求参数**:

```typescript
interface IQueryDownloadTaskReq {
  taskId: string;
}
```

**响应**:

```typescript
interface IQueryDownloadTaskRes {
  // 任务ID
  taskId: string;
  // 任务状态
  status: 'pending' | 'processing' | 'completed' | 'failed';
  // 下载链接（完成时）
  downloadUrl?: string;
  // 进度百分比
  progress?: number;
  // 错误信息（失败时）
  error?: string;
}
```

---

## 👥 用户分群 API

### 1. 创建分群

**接口**: `POST /data-analysis/segment/create`

**描述**: 基于条件创建用户分群。

**请求参数**:

```typescript
interface ISegmentCreateReq {
  // 分群名称
  name: string;
  
  // 分群描述
  description?: string;
  
  // 条件逻辑：and | or
  conditionLogic: 'and' | 'or';
  
  // 条件列表
  conditions: Array<{
    // 条件类型：behavior | attribute
    type: 'behavior' | 'attribute';
    
    // 行为条件（type=behavior 时）
    behavior?: {
      eventName: string;
      operator: 'count_gt' | 'count_lt' | 'count_eq' | 'has_done' | 'has_not_done';
      value?: number;
      timeWindow: number;  // 天数
    };
    
    // 属性条件（type=attribute 时）
    attribute?: {
      propertyName: string;
      operator: 'eq' | 'neq' | 'gt' | 'lt' | 'contains' | 'not_contains';
      value: any;
    };
  }>;
}
```

**响应**:

```typescript
interface ISegmentStats {
  // 分群ID
  segmentId: string;
  // 分群名称
  name: string;
  // 总用户数
  totalUsers: number;
  // 创建时间
  createdAt: string;
}
```

---

### 2. 查询分群用户列表

**接口**: `POST /data-analysis/segment/query`

**描述**: 查询分群中的用户列表。

**请求参数**:

```typescript
interface ISegmentQueryReq {
  // 分群ID
  segmentId: string;
  
  // 分页参数
  page?: number;
  pageSize?: number;
  
  // 排序参数
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
```

**响应**:

```typescript
interface ISegmentQueryRes {
  // 用户列表
  users: Array<{
    userId: string;
    userName?: string;
    // 其他用户属性
    [key: string]: any;
  }>;
  
  // 分页信息
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}
```

---

### 3. 导出分群用户列表

**接口**: `POST /data-analysis/segment/export`

**描述**: 导出分群用户列表为 CSV 格式。

**请求参数**:

```typescript
interface ISegmentExportReq {
  // 分群ID
  segmentId: string;
}
```

**响应**:

```typescript
{
  // 用户ID列表
  users: string[];
  // 总用户数
  total: number;
}
```

---

## 🔧 错误处理

所有接口在出错时返回以下格式：

```typescript
{
  statusCode: number;
  message: string;
  error?: string;
}
```

**常见错误码**:

| 状态码 | 说明 |
|--------|------|
| 400 | 请求参数错误 |
| 401 | 未认证 |
| 403 | 无权限 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |

---

## 📝 使用示例

### 留存分析示例

```bash
# 查询7日留存率
curl -X POST http://localhost:8101/api/data-analysis/retention/query \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "eventName": "page_view",
    "startDate": "2024-01-01",
    "endDate": "2024-01-31",
    "granularity": "day",
    "retentionWindow": 7
  }'
```

### 用户分羾示例

```bash
# 创建分群：过去7天内访问超过3次的用户
curl -X POST http://localhost:8101/api/data-analysis/segment/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "活跃用户",
    "description": "过去7天内访问超过3次的用户",
    "conditionLogic": "and",
    "conditions": [
      {
        "type": "behavior",
        "behavior": {
          "eventName": "page_view",
          "operator": "count_gt",
          "value": 3,
          "timeWindow": 7
        }
      }
    ]
  }'
```

---

## 🔗 相关文档

- [Web SDK 使用指南](../WEB_SDK_GUIDE.md)
- [Docker 部署指南](../docker-deployment.md)
- [系统架构文档](../SYSTEM_ARCHITECTURE.md)
