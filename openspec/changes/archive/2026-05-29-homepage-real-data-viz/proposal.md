# Proposal: Homepage Real Data Visualization

## Summary

将首页看板从当前的「看板列表 + 文字占位符」模式改造为企业级真实数据可视化看板，展示系统核心运营指标、事件趋势图和实时事件流。

## Motivation

当前首页 (`apps/frontend/src/pages/homepage/index.tsx`) 仅展示用户创建的分析看板列表，图表和表格区域均为文字占位符（"图表展示区域"、"表格展示区域"），无法让用户快速了解系统运行状态。需要将首页改造为类似 Grafana 风格的运营仪表板。

## Goals

- 首页展示 8 个核心统计卡片（今日事件总数、活跃用户数、新增用户数、漏斗转化率、事件趋势、用户留存率等），数据从后端 API 实时获取
- 图表区域使用 ECharts 渲染事件趋势折线图 + 用户活跃趋势折线图
- 表格区域展示实时事件流（最近的事件记录）
- 后端提供 3 个聚合 API 接口，数据源为 ClickHouse
- 前端新增 Redux (Rematch) model 管理首页状态

## Non-goals

- 不修改现有的看板 CRUD 功能
- 不修改系统数据总览页面
- 不实现用户自定义布局/拖拽功能
- 不实现实时 WebSocket 推送（使用轮询刷新）

## Scope

### Frontend
- `apps/frontend/src/pages/homepage/index.tsx` — 重写
- `apps/frontend/src/pages/homepage/styles.module.scss` — 重写
- `apps/frontend/src/pages/homepage/` — 新增 model.ts, services.ts, type.ts, 子组件目录

### Backend
- `apps/data-dashboard-api-service/src/api/homepage/` — 新增整个模块
- `apps/data-dashboard-api-service/src/app.module.ts` — 注册 HomepageModule

### Shared Types
- `libs/shared-types/src/lib/types/entity/SystemData.ts` — 新增 Homepage 相关类型

## Risks

- ClickHouse 查询性能：聚合查询需要合理使用分区键和索引
- 前端 ECharts 包体积：已确认 `echarts@^6.0.0` 已在依赖中
