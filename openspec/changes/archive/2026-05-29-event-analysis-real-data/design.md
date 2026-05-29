## Context

事件分析页面位于 `apps/frontend/src/pages/data-analysis/event/`，采用 Rematch (Redux) 状态管理。当前状态：

- **DataTable** 已完整对接真实 API：通过 `useModel('dataAnalysisEventModel')` 获取 `data`（类型为 `GenericEventAnalysisResult[]`），并根据 `useQuery()` 中的 `timeRange`、`eventInfoList`、`dimension` 动态渲染表格列和行。
- **DataChart** 仍使用硬编码 mock 数据（`['Mon','Tue','Wed','Thu','Fri','Sat','Sun']` 和 `[23,24,18,25,27,28,25]`），且在主页面 `index.tsx` 中被注释禁用。
- 后端 API `POST /data-analysis/event/query` 已完整实现，返回 `GenericEventAnalysisResult[]`，每行数据包含维度字段（`$device` 等）、事件名字段（`event_0_page_leave`）和事件-日期指标字段（`event_0_page_leave_2025_11_05`）。

数据流：URL query params → `DataFilterConfigArea` 筛选 → `dispatch.submitQuery()` → `services.submitQueryTask()` → API → `updateItem({ data })` → Redux store → 组件消费。

## Goals / Non-Goals

**Goals:**
- DataChart 组件从 Redux store 读取真实查询结果数据
- 图表动态适配 API 返回的字段结构，支持多事件折线对比
- X 轴展示日期范围，Y 轴展示指标值，每个事件一条折线
- 重新启用主页面中的 DataChart 组件

**Non-Goals:**
- 不修改后端 API 或 SQL 构建逻辑
- 不修改 DataTable 组件（已正常工作）
- 不修改筛选条件组件（已正确对接 URL 参数）
- 不添加图表交互功能（如点击钻取、缩放等高级功能）
- 不处理分页或大数据量优化

## Decisions

### 1. 数据源：复用 Redux store 中已有的 `data` 字段

**选择**: DataChart 通过 `useModel('dataAnalysisEventModel')` 获取 `data`，与 DataTable 共享同一数据源。

**理由**: Redux store 中的 `data` 已由 `submitQuery()` effect 正确填充，无需额外 API 调用或状态管理。DataTable 已验证该数据流可用。

**替代方案**: 为 DataChart 单独发起 API 请求 — 拒绝，因为会产生重复请求且增加后端负载。

### 2. 图表类型：多事件折线图

**选择**: 使用 ECharts 折线图（line），每个事件一个 series，X 轴为日期，Y 轴为指标值。

**理由**: 
- 折线图适合展示时间序列数据的趋势变化
- 多 series 对比可直观看出不同事件的指标差异
- 与表格的日期列结构天然对齐

**替代方案**: 柱状图 — 拒绝，日期较多时柱状图拥挤且不利于趋势观察。

### 3. 数据转换逻辑：在组件内 useMemo 处理

**选择**: 在 DataChart 组件内使用 `useMemo` 将 `GenericEventAnalysisResult[]` 转换为 ECharts option。

**理由**: 
- 转换逻辑与 DataTable 类似但输出格式不同（ECharts option vs 表格行列）
- 保持组件自包含，不引入额外工具函数
- 依赖项（data, timeRange, eventInfoList）变化时自动重算

**数据转换规则**:
- 从 `data` 中提取所有日期列（格式 `event_X_name_YYYY_MM_DD`）
- 按事件分组，每个事件生成一个 series
- X 轴标签为日期列表（从 timeRange 生成）

### 4. 图表容器：保持原有 DOM 结构

**选择**: 保留 `<div id="charts">` 作为 ECharts 容器，使用 `useRef` 管理实例。

**理由**: 与现有代码结构一致，最小化改动。

## Risks / Trade-offs

- **[风险] 数据为空时图表表现** → 处理：当 `data` 为空或未查询时，显示空状态提示而非空图表
- **[风险] 大量事件导致图例拥挤** → 缓解：当前场景事件数量有限（通常 2-5 个），暂不优化
- **[权衡] 图表与表格共享数据源** → 如果用户修改筛选条件但未点击查询，图表不会自动更新。这是预期行为，与 DataTable 保持一致