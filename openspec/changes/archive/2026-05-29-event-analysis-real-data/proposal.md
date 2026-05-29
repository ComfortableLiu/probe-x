## Why

事件分析页面的图表组件 `DataChat` 当前使用硬编码的 mock 数据（`'Mon','Tue','Wed'` 等静态数据），而同一页面的 `DataTable` 组件已正确对接后端 API 并展示真实数据。这导致图表展示与实际数据脱节，无法为用户提供数据趋势可视化分析能力。需要将 DataChat 组件从 mock 数据改为真实 API 数据驱动，使其与 DataTable 保持数据一致性。

## What Changes

- `DataChat` 组件（`components/DataChat/index.tsx`）从硬编码 mock 数据改为从 Redux store 读取真实查询结果
- `DataChat` 图表的 ECharts option 需要动态适配真实数据的字段结构（事件名、维度、日期等）
- 在主页面 `index.tsx` 中重新启用被注释掉的 `<DataChat />` 组件
- 图表需展示多事件对比的折线图，X 轴为日期，Y 轴为指标值，按事件分系列

## Capabilities

### New Capabilities
- `event-data-visualization`: 事件分析图表可视化能力 — DataChat 组件从 Redux store 读取真实 API 数据，动态渲染 ECharts 图表（多事件折线对比、日期轴、指标值轴）

### Modified Capabilities
<!-- 无已有 spec 需要修改 -->

## Impact

- **前端组件**: `apps/frontend/src/pages/data-analysis/event/components/DataChat/index.tsx` — 主要修改目标
- **前端页面**: `apps/frontend/src/pages/data-analysis/event/index.tsx` — 取消注释启用 DataChat
- **Redux store**: `dataAnalysisEventModel` 已有 `data` 和 `updateTime` 字段，DataChat 需通过 `useModel` 消费这些数据
- **API**: 后端 `POST /data-analysis/event/query` 已完整实现，返回 `GenericEventAnalysisResult[]`，无需后端改动
- **共享类型**: `IEventAnalysisReq`、`IEventAnalysisRes`、`GenericEventAnalysisResult` 已定义完善