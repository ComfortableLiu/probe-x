## Why

归因分析页面（`apps/frontend/src/pages/data-analysis/attribution/`）当前仅有 `DataTable` 组件，以合并单元格+进度条的方式展示归因数据。虽然表格能展示详细的触点-维度交叉数据，但缺少直观的可视化图表来帮助用户快速理解：

1. **贡献度分布** — 各触点/渠道对转化的贡献占比，表格中的百分比数字不够直观
2. **模型对比** — 不同归因模型（首次触点、末次触点、线性等）下触点贡献的差异，当前只能查看单一模型
3. **转化路径** — 角点事件的转化漏斗，展示从触点到转化的流失情况

对比其他分析页面（事件分析有折线图、漏斗分析有漏斗图、用户路径有桑基图），归因分析是唯一没有图表的页面。

## What Changes

### 新增 3 个 ECharts 图表组件

1. **贡献度饼图** (`ContributionPieChart`) — 展示各触点事件的贡献度占比分布
   - 使用 ECharts Pie Chart
   - 从 `IAttributionAnalysisRes.tableData` 提取各触点的 `contribution.rate`
   - 按归因事件名聚合（相同事件名的不同维度行合并）
   - 支持 tooltip 显示详细数值，支持点击高亮

2. **归因模型对比柱状图** (`ModelComparisonBar`) — 对比不同归因模型下的触点贡献差异
   - 使用 ECharts Bar Chart（分组柱状图）
   - 需要新增 Redux effect `queryAllModels`，并行查询 5 种归因模型的数据
   - X 轴为触点事件名，每个模型一组柱子
   - 新增 Redux state 字段 `modelComparisonData`

3. **归因漏斗图** (`AttributionFunnelChart`) — 展示触点事件到转化的漏斗
   - 使用 ECharts Funnel Chart
   - 从 `IAttributionAnalysisRes` 提取各触点的转化指标和转化率
   - 按归因事件名聚合转化指标，按贡献度降序排列

### Redux State 扩展

- `dataAnalysisAttributionModel` 新增 `modelComparisonData` 字段
- 新增 `queryAllModels` effect，并行调用 5 次 `submitQueryTask`
- 新增 `IModelComparisonData` 类型

### 页面集成

- 在 `attribution/index.tsx` 的 `DataTable` 之前插入图表区域
- 图表区域包含饼图、漏斗图（一行两列布局）+ 模型对比柱状图（全宽）

## Capabilities

### New Capabilities
- `attribution-contribution-pie`: 贡献度饼图 — 展示各触点事件的贡献度占比
- `attribution-model-comparison-bar`: 归因模型对比柱状图 — 对比 5 种归因模型下的触点贡献差异
- `attribution-funnel-chart`: 归因漏斗图 — 展示触点到转化的漏斗

### Modified Capabilities
- `dataAnalysisAttributionModel`: 扩展 Redux state 和 effects，支持多模型对比查询

## Impact

- **前端新增组件**:
  - `apps/frontend/src/pages/data-analysis/attribution/components/ContributionPieChart/`
  - `apps/frontend/src/pages/data-analysis/attribution/components/ModelComparisonBar/`
  - `apps/frontend/src/pages/data-analysis/attribution/components/AttributionFunnelChart/`
- **前端修改**:
  - `apps/frontend/src/pages/data-analysis/attribution/index.tsx` — 集成图表组件
  - `apps/frontend/src/pages/data-analysis/attribution/model.ts` — 新增 state 和 effect
  - `apps/frontend/src/pages/data-analysis/attribution/type.ts` — 新增类型定义
  - `apps/frontend/src/pages/data-analysis/attribution/styles.module.scss` — 新增图表布局样式
- **后端**: 无需修改，复用 `POST /data-analysis/attribution/query` 接口
- **共享类型**: 无需修改，已有完整类型定义
- **依赖**: 已有 `echarts: ^6.0.0`，无需新增依赖
