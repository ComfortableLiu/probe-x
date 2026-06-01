# Tasks: Homepage Real Data Visualization

## Phase 1: Shared Types (libs/shared-types)

- [x] **T1** — 在 `libs/shared-types/src/lib/types/entity/SystemData.ts` 中新增 `IHomepageOverview`、`IHomepageTrend`、`IRealtimeEvent`、`IRealtimeEventsResponse` 接口定义

## Phase 2: Backend (apps/data-dashboard-api-service)

- [x] **T2** — 创建 `src/api/homepage/type.ts`（backend DTO 类型）
- [x] **T3** — 创建 `src/api/homepage/homepage.service.ts`（ClickHouse 查询服务，含 overview/trend/realtime-events 三个方法，带 Redis 缓存）
- [x] **T4** — 创建 `src/api/homepage/homepage.controller.ts`（3 个 GET 接口）
- [x] **T5** — 创建 `src/api/homepage/homepage.module.ts`（NestJS 模块注册）
- [x] **T6** — 在 `src/app.module.ts` 中注册 `HomepageModule`

## Phase 3: Frontend Types & Services

- [x] **T7** — 创建 `apps/frontend/src/pages/homepage/type.ts`（前端状态类型）
- [x] **T8** — 创建 `apps/frontend/src/pages/homepage/services.ts`（3 个 API 调用函数）

## Phase 4: Frontend State Model

- [x] **T9** — 创建 `apps/frontend/src/pages/homepage/model.ts`（Rematch model，含 fetchHomepageData/fetchRealtimeEvents effects）
- [x] **T10** — 在 `apps/frontend/src/store/models/index.ts` 中注册 `homepageModel`

## Phase 5: Frontend Components

- [x] **T11** — 创建 `apps/frontend/src/pages/homepage/components/StatCards/index.tsx` + `styles.module.scss`（8 个统计卡片组件）
- [x] **T12** — 创建 `apps/frontend/src/pages/homepage/components/TrendChart/index.tsx` + `styles.module.scss`（ECharts 双轴折线图组件）
- [x] **T13** — 创建 `apps/frontend/src/pages/homepage/components/EventTable/index.tsx` + `styles.module.scss`（实时事件流表格组件）

## Phase 6: Homepage Main Page

- [x] **T14** — 重写 `apps/frontend/src/pages/homepage/index.tsx`（组装所有子组件，调用 model 加载数据）
- [x] **T15** — 重写 `apps/frontend/src/pages/homepage/styles.module.scss`（新布局样式）

## Dependency Graph

```
T1 → T2 → T3 → T4 → T5 → T6
T1 → T7 → T8 → T9 → T10
T10 → T11, T12, T13 → T14, T15
```
