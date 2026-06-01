## 1. Redux State 扩展

- [x] 1.1 在 `type.ts` 中新增 `IModelComparisonItem` 接口，扩展 `IDataAnalysisAttributionState` 增加 `modelComparisonData?: IModelComparisonItem[]`
- [x] 1.2 在 `model.ts` 中新增 `queryAllModels` effect：使用 `Promise.all` 并行调用 5 次 `submitQueryTask`，存储结果到 `modelComparisonData`
- [x] 1.3 在 `submitQuery` effect 中清空 `modelComparisonData`

## 2. 贡献度饼图组件

- [x] 2.1 创建 `components/ContributionPieChart/index.tsx`：从 Redux store 读取 `data`，按 `attributionEventName` 聚合贡献度
- [x] 2.2 实现 ECharts Pie Chart：tooltip 显示事件名、贡献百分比、转化指标
- [x] 2.3 创建 `components/ContributionPieChart/styles.module.scss`
- [x] 2.4 处理空数据状态：显示 Empty 组件

## 3. 归因漏斗图组件

- [x] 3.1 创建 `components/AttributionFunnelChart/index.tsx`：从 Redux store 读取 `data`，按 `attributionEventName` 聚合转化指标
- [x] 3.2 实现 ECharts Funnel Chart：按转化指标降序排列，tooltip 显示事件名、转化指标、转化率
- [x] 3.3 创建 `components/AttributionFunnelChart/styles.module.scss`
- [x] 3.4 处理空数据状态

## 4. 归因模型对比柱状图组件

- [x] 4.1 创建 `components/ModelComparisonBar/index.tsx`：从 Redux store 读取 `modelComparisonData`
- [x] 4.2 实现 ECharts Bar Chart（分组柱状图）：X 轴为触点事件名，每个模型一组柱子
- [x] 4.3 实现图表 legend 显示 5 种模型中文名
- [x] 4.4 创建 `components/ModelComparisonBar/styles.module.scss`
- [x] 4.5 处理 loading 状态和空数据状态

## 5. 页面集成

- [x] 5.1 在 `attribution/index.tsx` 中引入 3 个图表组件
- [x] 5.2 在 `DataFilterConfigArea` 和 `DataTable` 之间添加图表区域
- [x] 5.3 实现饼图+漏斗图一行两列布局
- [x] 5.4 添加"模型对比"按钮，触发 `queryAllModels`
- [x] 5.5 在 `styles.module.scss` 中添加图表布局样式

## 6. 验证

- [ ] 6.1 验证饼图正确展示贡献度分布
- [ ] 6.2 验证漏斗图正确展示转化漏斗
- [ ] 6.3 验证模型对比柱状图正确展示 5 种模型的对比数据
- [ ] 6.4 验证空数据状态显示正确
- [ ] 6.5 验证窗口 resize 时图表自适应
