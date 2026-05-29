## 1. 共享类型定义

- [x] 1.1 在 `libs/shared-types/src/lib/types/request/data-analysis/` 新增 `free-analysis.ts`，定义 `IFreeAnalysisReq` 和 `IFreeAnalysisRes` 类型
- [x] 1.2 在 `AnalysisType` 枚举中新增 `FREE = 'free'`
- [x] 1.3 在 `IDashboardConfig` 接口中新增 `freeAnalysis` 字段
- [x] 1.4 在 `libs/shared-types/src/lib/types/request/index.ts` 中导出新类型

## 2. 后端 API 实现

- [x] 2.1 在 `apps/data-dashboard-api-service/src/api/data-analysis/` 新增 `free-analysis.service.ts`，复用 `generateEventAnalysisSql()` 实现查询逻辑
- [x] 2.2 在 `data-analysis.controller.ts` 新增 `POST /data-analysis/free/query` 端点
- [x] 2.3 在 `data-analysis.module.ts` 注册 `FreeAnalysisService`

## 3. 前端 Model 和 Services

- [x] 3.1 在 `apps/frontend/src/pages/data-analysis/free/` 新增 `type.ts`，定义 `IDataAnalysisFreeState` 和 `IQuery` 类型
- [x] 3.2 新增 `services.ts`，实现 `submitQueryTask` API 调用
- [x] 3.3 新增 `model.ts`，创建 `dataAnalysisFreeModel` Rematch model（包含 init、checkQueryParams、submitQuery effects）
- [x] 3.4 在 `apps/frontend/src/store/models/index.ts` 注册 `dataAnalysisFreeModel`

## 4. 前端页面组件实现

- [x] 4.1 新增 `components/EventSelector/index.tsx`，实现左侧事件选择面板（复用 EventItem 组件）
- [x] 4.2 新增 `components/DataFilterConfigArea/index.tsx`，实现中间查询条件配置区（复用 GlobalFilter、DimensionSelector、TimeRangeSelector）
- [x] 4.3 新增 `components/DataChart/index.tsx`，实现右侧 ECharts 图表展示（支持折线图/柱状图切换）
- [x] 4.4 新增 `components/DataTable/index.tsx`，实现数据明细表格（维度合并展示）
- [x] 4.5 重写 `index.tsx` 主页面，组合三栏布局 + DataAnalysisHeader + SaveAsDashboardPopup
- [x] 4.6 编写 `styles.module.scss` 页面样式

## 5. 路由和导航

- [x] 5.1 在 `apps/frontend/src/router/page/DataAnalysis.tsx` 中移除自由分析路由的 `isHidden: true`

## 6. 看板集成

- [x] 6.1 在 `SaveAsDashboardPopup` 组件中新增 `AnalysisType.FREE` 的处理分支
