# Design: Homepage Real Data Visualization

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│                    Frontend                       │
│  ┌─────────────────────────────────────────────┐ │
│  │            Homepage (index.tsx)              │ │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐ │ │
│  │  │ StatCards  │ │  ECharts  │ │ EventTable│ │ │
│  │  │ (8 cards) │ │  (trend)  │ │ (realtime)│ │ │
│  │  └─────┬─────┘ └─────┬─────┘ └─────┬─────┘ │ │
│  │        └──────────────┼──────────────┘       │ │
│  │                 homepageModel (Rematch)       │ │
│  │                       │                       │ │
│  │              services.ts (axios)              │ │
│  └───────────────────────┼───────────────────────┘ │
└──────────────────────────┼─────────────────────────┘
                           │ HTTP GET
┌──────────────────────────┼─────────────────────────┐
│                    Backend (NestJS)                  │
│  ┌───────────────────────┼───────────────────────┐  │
│  │  HomepageController   │                       │  │
│  │  GET /api/homepage/overview                   │  │
│  │  GET /api/homepage/trend                      │  │
│  │  GET /api/homepage/realtime-events            │  │
│  └───────────┬───────────┴───────────────────────┘  │
│              │                                       │
│  ┌───────────┴───────────┐                          │
│  │   HomepageService     │                          │
│  │   (ClickHouse queries)│                          │
│  └───────────┬───────────┘                          │
│              │                                       │
│       ┌──────┴──────┐                               │
│       │ ClickHouse  │                               │
│       │ event_log   │                               │
│       │ final_event │                               │
│       └─────────────┘                               │
└─────────────────────────────────────────────────────┘
```

## API Design

### GET /api/homepage/overview
聚合统计接口，返回首页 8 个核心指标。

**Response:**
```typescript
interface IHomepageOverview {
  todayEventCount: number;        // 今日事件总数
  activeUserCount: number;        // 今日活跃用户数 (distinct device_id)
  newUserCount: number;           // 今日新增用户数 (首次出现的 device_id)
  funnelConversionRate: number;   // 平均漏斗转化率 (%)
  eventTrendCount: number;        // 事件趋势（近7日总量）
  userRetentionRate: number;      // 用户留存率 (%)
  yesterdayEventCount: number;    // 昨日事件总数（用于计算环比）
  yesterdayActiveUserCount: number; // 昨日活跃用户数
  weekEventCount: number;         // 本周事件总数
  totalEventCount: number;        // 总事件数
}
```

**ClickHouse Queries:**
- `todayEventCount`: `SELECT count(*) FROM event_log WHERE toDate($service_time) = today()`
- `activeUserCount`: `SELECT uniq(device_id) FROM event_log WHERE toDate($service_time) = today()`
- `newUserCount`: `SELECT count(*) FROM (SELECT device_id, min(toDate($service_time)) as first_day FROM event_log GROUP BY device_id HAVING first_day = today())`
- `yesterdayEventCount`: `SELECT count(*) FROM event_log WHERE toDate($service_time) = yesterday()`

### GET /api/homepage/trend
趋势数据接口，返回近 N 天的事件量和活跃用户量趋势。

**Query Params:**
- `days` (number, default: 7) — 天数

**Response:**
```typescript
interface IHomepageTrend {
  dates: string[];           // 日期列表 ['2026-05-22', ...]
  eventCounts: number[];     // 每日事件量
  activeUserCounts: number[]; // 每日活跃用户量
}
```

**ClickHouse Query:**
```sql
SELECT
  toDate($service_time) as date,
  count(*) as event_count,
  uniq(device_id) as active_user_count
FROM event_log
WHERE toDate($service_time) >= today() - {days}
GROUP BY date
ORDER BY date
```

### GET /api/homepage/realtime-events
实时事件流接口，返回最近的事件记录。

**Query Params:**
- `limit` (number, default: 20) — 返回条数

**Response:**
```typescript
interface IRealtimeEvent {
  eventName: string;
  deviceId: string;
  path: string;
  ip: string;
  serviceTime: string;
}

interface IRealtimeEventsResponse {
  list: IRealtimeEvent[];
  total: number; // 今日总数
}
```

## Frontend Design

### State Model (Rematch)
```typescript
// model name: homepageModel
interface IHomepageState {
  loading: boolean;
  overview: IHomepageOverview;
  trend: IHomepageTrend;
  realtimeEvents: IRealtimeEventsResponse;
}
```

### Component Structure
```
homepage/
├── index.tsx              — 主页面
├── styles.module.scss     — 样式
├── model.ts               — Rematch model
├── services.ts            — API 调用
├── type.ts                — 类型定义
└── components/
    ├── StatCards/
    │   ├── index.tsx      — 8个统计卡片
    │   └── styles.module.scss
    ├── TrendChart/
    │   ├── index.tsx      — ECharts 趋势折线图
    │   └── styles.module.scss
    └── EventTable/
        ├── index.tsx      — 实时事件流表格
        └── styles.module.scss
```

### Layout
```
┌──────────────────────────────────────────────┐
│  PageHeader: 数据看板    [刷新]              │
├──────────────────────────────────────────────┤
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐        │
│ │今日  │ │活跃  │ │新增  │ │转化  │        │
│ │事件  │ │用户  │ │用户  │ │率    │        │
│ │12,345│ │3,456 │ │234  │ │12.5%│        │
│ └──────┘ └──────┘ └──────┘ └──────┘        │
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐        │
│ │7日   │ │留存  │ │昨日  │ │总事件│        │
│ │趋势  │ │率    │ │对比  │ │数    │        │
│ │↑12% │ │45.2%│ │↑8.3%│ │1.2M │        │
│ └──────┘ └──────┘ └──────┘ └──────┘        │
├──────────────────────────────────────────────┤
│  [事件趋势折线图 + 用户活跃趋势折线图]       │
│  ECharts dual-axis line chart               │
├──────────────────────────────────────────────┤
│  [实时事件流表格]                            │
│  事件名称 | 设备ID | 路径 | IP | 时间       │
│  ...                                        │
└──────────────────────────────────────────────┘
```

## Backend Module Structure

```
apps/data-dashboard-api-service/src/api/homepage/
├── homepage.module.ts
├── homepage.controller.ts
├── homepage.service.ts
└── type.ts
```

### HomepageModule 依赖
- `ClickHouseModule` — 查询 event_log / final_event_log
- `RedisModule` — 缓存聚合结果（TTL 60s）
- `TypeOrmModule.forFeature([UserRoleRelation, Role])` — 权限校验（复用 SsoAuthGuard）

## Conventions

- 后端遵循现有 NestJS 模块模式（参考 `dashboard.module.ts`、`system-data/`）
- 前端遵循 Rematch model 模式（参考 `system-data/overview/model.ts`）
- API 请求使用 `@/lib/request` 封装
- 类型定义放在 shared-types 或页面本地 type.ts
- ECharts 使用 `import * as echarts from "echarts"` 方式
- 样式使用 SCSS Modules (`styles.module.scss`)
