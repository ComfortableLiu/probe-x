## Why

自由分析页面目前仅包含一个 PageHeader 和说明按钮的空壳，无法满足用户自助组合查询条件进行灵活数据分析的需求。事件分析页面虽然功能完善，但其查询结构相对固定（事件+日期维度）。自由分析需要支持更灵活的维度组合和指标选择，让用户能够像使用自助 BI 工具一样自由探索数据。现在实现此功能可以补全数据分析模块的最后一块拼图。

## What Changes

- **前端自由分析页面**：从空壳页面改造为企业级自助数据分析页面，包含左侧事件/指标选择面板、中间查询条件配置区、右侧结果展示区（ECharts 图表 + 数据明细表格）
- **后端自由分析 API**：新增 `POST /api/data-analysis/free/query` 接口，复用 `EventAnalysisSqlBuilder` 的基础能力，支持更灵活的维度组合
- **路由可见性**：取消 `isHidden: true`，让自由分析菜单对用户可见
- **看板保存**：支持将查询结果保存为自定义看板卡片，对接现有看板配置功能

## Capabilities

### New Capabilities
- `free-analysis`: 自由分析页面的完整功能，包括前端三栏布局（事件选择、查询配置、结果展示）、后端查询 API、看板保存集成

### Modified Capabilities
- `event-data-visualization`: 无需修改 spec 级别的需求，自由分析复用事件分析的图表渲染模式

## Impact

- **前端**：`apps/frontend/src/pages/data-analysis/free/` 目录下新增多个组件和文件；`apps/frontend/src/store/models/index.ts` 注册新 model；`apps/frontend/src/router/page/DataAnalysis.tsx` 修改路由配置
- **后端**：`apps/data-dashboard-api-service/src/api/data-analysis/` 新增自由分析 service 和 controller 端点；`data-analysis.module.ts` 注册新 service
- **共享类型**：`libs/shared-types/src/lib/types/request/data-analysis/` 新增自由分析请求/响应类型
- **看板集成**：`AnalysisType` 枚举新增 `FREE` 类型；`SaveAsDashboardPopup` 组件支持自由分析类型
