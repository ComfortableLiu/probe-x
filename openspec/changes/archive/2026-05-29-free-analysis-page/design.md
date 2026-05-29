## Context

Probe-X 的数据分析模块目前包含事件分析、漏斗分析、用户路径分析、归因分析四个子页面。自由分析页面（`/data-analysis/free`）虽然路由已注册，但页面内容为空壳（仅 PageHeader + 说明按钮），且在菜单中通过 `isHidden: true` 隐藏。

事件分析页面已建立完整的前后端模式：URL 参数驱动查询 → Rematch Model 管理状态 → EventAnalysisSqlBuilder 生成 ClickHouse SQL → 结果通过 ECharts 图表和表格展示。自由分析需要复用此模式，同时提供更灵活的查询能力。

## Goals / Non-Goals

**Goals:**
- 提供企业级自助数据分析页面，支持用户自由组合事件、指标、维度进行查询
- 复用 EventAnalysisSqlBuilder 的 SQL 生成能力，避免重复造轮子
- 复用已有的共享组件（EventItem、GlobalFilter、DimensionSelector、TimeRangeSelector、SaveAsDashboardPopup）
- 支持查询结果保存为看板卡片

**Non-Goals:**
- 不实现自定义 SQL 编辑器（高级功能，后续迭代）
- 不支持跨数据源联合查询
- 不实现实时数据推送
- 不修改现有事件分析页面的功能

## Decisions

### 1. 前端架构：复用事件分析的 URL 参数驱动模式

**决策**：自由分析页面采用与事件分析相同的架构模式——查询参数通过 URL query string 传递，Rematch Model 管理查询结果状态。

**理由**：
- 与现有代码风格一致，降低维护成本
- URL 参数可分享、可书签保存
- 复用 `useQuery`、`useRouter`、`useModel` 等现有 hooks

**替代方案**：纯组件 state 管理——优点是简单，但无法分享查询配置。

### 2. 后端 API：复用 EventAnalysisSqlBuilder + 独立 Service

**决策**：新增 `FreeAnalysisService`，内部调用 `generateEventAnalysisSql()` 生成 SQL，controller 新增 `POST /data-analysis/free/query` 端点。

**理由**：
- EventAnalysisSqlBuilder 已经支持灵活的事件+维度+筛选组合
- 自由分析的请求结构与事件分析基本一致（`IEventAnalysisReq`），无需重新设计 SQL 生成器
- 独立 Service 便于后续扩展差异化的查询逻辑

### 3. 页面布局：三栏式自适应布局

**决策**：左侧事件/指标选择面板（可折叠）、中间查询条件配置区、右侧结果展示区（图表+表格）。

**理由**：
- 参考主流 BI 工具（如 Metabase、Tableau）的交互模式
- 左侧面板提供事件和属性的快速选择
- 中间区域专注查询配置
- 右侧区域最大化结果展示空间

### 4. 看板集成：扩展 AnalysisType 枚举

**决策**：在 `AnalysisType` 枚举中新增 `FREE = 'free'`，`SaveAsDashboardPopup` 组件和 `IDashboardConfig` 接口扩展自由分析类型支持。

**理由**：
- 与现有看板保存模式完全一致
- 首页看板展示可直接复用事件分析的渲染逻辑

## Risks / Trade-offs

- **[SQL 性能]** 自由分析允许更多维度组合可能导致 ClickHouse 查询变慢 → Mitigation：限制最大维度数量（5个），前端添加查询超时提示
- **[URL 长度]** 复杂查询参数可能导致 URL 过长 → Mitigation：使用 POST 请求传递查询参数，URL 仅存储关键标识
- **[组件复用度]** 自由分析与事件分析的共享组件可能产生耦合 → Mitigation：通过 props 控制差异行为，保持组件的通用性

## Migration Plan

1. 新增共享类型（`IFreeAnalysisReq` / `IFreeAnalysisRes`）
2. 新增后端 Service + Controller 端点
3. 新增前端 Model、Services、组件
4. 注册 Model 到 Store
5. 取消路由 `isHidden`
6. 验证：手动测试完整查询流程 + 看板保存
