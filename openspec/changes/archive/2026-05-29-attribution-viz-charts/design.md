## Context

归因分析页面位于 `apps/frontend/src/pages/data-analysis/attribution/`，采用 Rematch (Redux) 状态管理。当前状态：

- **DataTable** 已完整对接真实 API：通过 `useModel('dataAnalysisAttributionModel')` 获取 `data`（类型为 `IAttributionAnalysisRes`），展示合并单元格表格+进度条。
- **无图表组件**：对比事件分析（DataChat 折线图）、漏斗分析（DataChat 漏斗图）、用户路径（DataChat 桑基图），归因分析缺少可视化图表。
- 后端 API `POST /data-analysis/attribution/query` 已完整实现，返回 `IAttributionAnalysisRes`，包含 `tableHeader`、`tableData`（含各触点的 `touchPointData` 和 `conversionData.contribution`）、`total`。
- `AttributionModelEnum` 定义了 5 种归因模型：`FIRST_TOUCH`、`LAST_TOUCH`、`LINEAR`、`POSITION`、`TIME_DECAY`。

数据流：URL query params → `DataFilterConfigArea` 筛选 → `dispatch.submitQuery()` → `services.submitQueryTask()` → API → `updateItem({ data })` → Redux store → 组件消费。

## Goals / Non-Goals

**Goals:**
- 新增贡献度饼图，从 `tableData` 提取各触点贡献度占比
- 新增归因模型对比柱状图，并行查询 5 种模型数据进行对比
- 新增归因漏斗图，展示触点到转化的转化漏斗
- 图表组件通过 `useModel` 从 Redux store 读取数据
- 在主页面中集成图表组件

**Non-Goals:**
- 不修改后端 API 或 SQL 构建逻辑
- 不修改 DataTable 组件（已正常工作）
- 不修改筛选条件组件
- 不添加图表钻取或高级交互
- 不修改共享类型定义

## Decisions

### 1. 数据源：复用 Redux store 中已有的 `data` 字段 + 新增 `modelComparisonData`

**选择**: 饼图和漏斗图复用 `dataAnalysisAttributionModel.data`；模型对比图使用新增的 `modelComparisonData` 字段，通过新增 `queryAllModels` effect 并行查询 5 种模型。

**理由**: 
- 饼图和漏斗图只需当前模型的数据，复用已有数据源零成本
- 模型对比需要跨模型数据，需新增查询逻辑，但复用已有 API 接口

### 2. 贡献度聚合策略：按归因事件名聚合

**选择**: `tableData` 中可能存在同一事件名+不同维度的多行数据，饼图和漏斗图按 `attributionEventName` 聚合，贡献度求和，转化指标求和。

**理由**: 饼图/漏斗图展示的是事件级别的贡献分布，不应细分到维度级别（维度级别的详情由 DataTable 展示）。

### 3. 模型对比查询：并行查询 5 种模型

**选择**: `queryAllModels` effect 使用 `Promise.all` 并行调用 5 次 `submitQueryTask`，每次使用不同的 `attributionModel` 参数，其余参数保持一致。

**理由**: 
- 5 种模型查询之间无依赖关系，适合并行
- 复用已有的 `submitQueryTask` service，无需新增后端接口
- 并行查询比串行快约 5 倍

**替代方案**: 后端新增批量查询接口 — 拒绝，当前阶段前端并行调用已足够，后续如性能有问题再优化。

### 4. 图表布局：饼图+漏斗图一行两列，柱状图全宽

**选择**: 使用 CSS Grid 布局，饼图和漏斗图各占 50% 宽度，柱状图独占一行。

**理由**: 
- 饼图和漏斗图信息互补（占比 vs 漏斗），并排放置方便对比
- 柱状图包含 5 组数据，需要更多横向空间

### 5. 图表组件结构：每个图表独立组件

**选择**: 3 个图表各自独立为一个组件目录（含 `index.tsx` + `styles.module.scss`），与 DataTable 同级。

**理由**: 与项目中其他分析页面的组件结构保持一致（如 funnel/DataChat、user-path/DataChat）。

## Risks / Trade-offs

- **[风险] 模型对比查询耗时** → 5 次并行查询可能较慢。缓解：显示 loading 状态，仅在用户主动点击时触发查询
- **[风险] 数据为空时图表表现** → 处理：当 `data` 为空时显示 Empty 状态
- **[权衡] 按事件名聚合丢失维度信息** → 饼图/漏斗图不展示维度级别的细分，这是有意设计，避免图表过于复杂
