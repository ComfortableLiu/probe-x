# Probe-X 数据分析 API 文档

## 概述

本文档描述了 Probe-X 数据分析模块的 API 接口，包括留存分析和用户分群功能。

**Base URL**: `http://localhost:8101/api`

**认证方式**: JWT Token（通过 Header 传递）

---

## 📊 留存分析 API

### 1. 查询留存数据

**接口**: `POST /data-analysis/retention/query`

**描述**: 查询用户留存分析数据。以触发起始事件的用户为队列，按特定日期留存（第 N 天/周/月）口径计算各留存窗口的留存人数与留存率：队列用户在队列周期后第 N 个粒度周期内触发回访事件才算留存（窗口单位跟随时间粒度，按日即第 N 天当天、按周即第 N 周、按月即第 N 月），各窗口独立计算。实体口径为登录用户按 `$uid`、匿名用户回退按 `$device_id`，时间字段统一使用客户端日志时间 `$log_time`；设置分组维度时按队列周期内首个起始事件的属性值归入唯一分组（单分组口径），回访行为不做属性关联。

**权限**: `data:analysis:view`

**请求参数**:

```typescript
interface IRetentionAnalysisReq {
  // 起始事件（用户首次触发、进入队列的事件）
  startEvent: {
    eventName: string;
    filters?: IAttributionAnalysisFilter[];  // 事件筛选条件（可选）
  };

  // 回访事件（用于判定留存的事件，可与起始事件相同）
  returnEvent: {
    eventName: string;
    filters?: IAttributionAnalysisFilter[];  // 事件筛选条件（可选）
  };

  // 时间范围 [开始日期, 结束日期]，闭区间
  timeRange: ['YYYY-MM-DD', 'YYYY-MM-DD'];

  // 留存窗口列表（1-365 的整数，可多选，如 [1, 3, 7, 14, 30]；窗口单位跟随时间粒度：第 N 日/周/月）
  retentionWindows: number[];

  // 时间粒度：DAY | WEEK | MONTH（队列按日 / 周 / 月划分）
  granularity: 'DAY' | 'WEEK' | 'MONTH';

  // 分组维度（可选，按用户属性或事件属性分组对比）
  dimension?: string[];

  // 全局筛选条件（可选）
  globalFilters?: IAttributionAnalysisFilter[];
}

// 筛选条件
interface IAttributionAnalysisFilter {
  propertyName: string;                              // 属性名
  propertyType: MetaPropertyType;                    // 属性类型
  propertyValue: string | number | string[] | number[];  // 属性值
  compareType: CompareType;                          // 比较方式（等于 / 不等于 / 大于等）
}
```

**响应**:

```typescript
interface IRetentionAnalysisRes {
  // 队列数据（每行一个 队列日期 × 维度组合）
  cohorts: Array<{
    // 队列日期
    cohortDate: string;
    // 队列规模（该周期内触发起始事件的去重用户数）
    cohortSize: number;
    // 各窗口的留存数据，按窗口升序
    windows: Array<{
      day: number;             // 窗口（单位跟随粒度）
      retentionUsers: number;  // 留存用户数
      retentionRate: number;   // 留存率（百分数，保留两位小数）
    }>;
    // 分组维度值（指定 dimension 时返回，key 为维度名）
    dimensionValues?: Record<string, string>;
  }>;

  // 汇总信息
  summary: {
    // 全部队列的总用户数
    totalUsers: number;
    // 各窗口的加权留存率（已成熟队列的留存人数之和 ÷ 初始人数之和；已成熟指队列日期 + N 个粒度单位 ≤ 今天）
    avgRetentionRates: Array<{
      day: number;
      retentionUsers: number;
      retentionRate: number;
    }>;
  };
}
```

**示例请求**:

```json
{
  "startEvent": {
    "eventName": "app_launch"
  },
  "returnEvent": {
    "eventName": "page_view"
  },
  "timeRange": ["2026-10-01", "2026-10-14"],
  "retentionWindows": [1, 3, 7, 14],
  "granularity": "DAY",
  "dimension": ["$channel"]
}
```

**示例响应**:

```json
{
  "cohorts": [
    {
      "cohortDate": "2026-10-01",
      "cohortSize": 1200,
      "windows": [
        { "day": 1, "retentionUsers": 456, "retentionRate": 38.00 },
        { "day": 3, "retentionUsers": 312, "retentionRate": 26.00 },
        { "day": 7, "retentionUsers": 216, "retentionRate": 18.00 },
        { "day": 14, "retentionUsers": 144, "retentionRate": 12.00 }
      ],
      "dimensionValues": { "$channel": "app_store" }
    }
  ],
  "summary": {
    "totalUsers": 1200,
    "avgRetentionRates": [
      { "day": 1, "retentionUsers": 456, "retentionRate": 38.00 },
      { "day": 3, "retentionUsers": 312, "retentionRate": 26.00 },
      { "day": 7, "retentionUsers": 216, "retentionRate": 18.00 },
      { "day": 14, "retentionUsers": 144, "retentionRate": 12.00 }
    ]
  }
}
```

---

### 2. 创建留存数据下载任务

**接口**: `POST /data-analysis/retention/download`

**描述**: 创建留存分析数据的异步下载任务。任务进入 BullMQ 队列执行，完成后生成中文表头的留存网格 Excel 文件（列顺序：队列日期 → 队列用户数 → 维度列 → 各窗口的「第N日留存率 / 第N日留存人数」）并上传至文件存储。

**权限**: `data:analysis:export`

**请求参数**: 与查询接口相同（`IRetentionAnalysisReq`）

**响应**:

```typescript
interface ISubmitDownloadTaskRes {
  // 任务ID，用于查询任务进度
  taskId: string;
}
```

**示例响应**:

```json
{
  "taskId": "f47ac10b-58cc-4372-a567-0e02b2c3d479"
}
```

---

### 3. 查询下载任务进度

**接口**: `POST /data-analysis/retention/download/task`

**描述**: 查询留存分析下载任务的进度和结果。任务状态保留 24 小时，过期后查询返回「任务不存在」。

**权限**: `data:analysis:export`

**请求参数**:

```typescript
interface IQueryDownloadTaskReq {
  taskId: string;
}
```

**响应**:

```typescript
interface IQueryDownloadTaskRes {
  // 任务状态：RUNNING-执行中 | SUCCESS-已完成 | FAIL-失败
  status: 'SUCCESS' | 'FAIL' | 'RUNNING';
  // 下载链接（status 为 SUCCESS 时返回）
  downloadUrl?: string;
}
```

**示例请求**:

```json
{
  "taskId": "f47ac10b-58cc-4372-a567-0e02b2c3d479"
}
```

**示例响应**:

```json
{
  "status": "SUCCESS",
  "downloadUrl": "http://localhost:9000/downloads/留存分析数据导出_f47ac10b-58cc-4372-a567-0e02b2c3d479.xlsx"
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
# 查询次日 / 3 日 / 7 日留存率
curl -X POST http://localhost:8101/api/data-analysis/retention/query \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "startEvent": { "eventName": "app_launch" },
    "returnEvent": { "eventName": "page_view" },
    "timeRange": ["2026-10-01", "2026-10-14"],
    "retentionWindows": [1, 3, 7],
    "granularity": "DAY"
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
