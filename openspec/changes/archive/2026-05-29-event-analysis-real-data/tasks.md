## 1. DataChart 组件改造

- [x] 1.1 重写 `DataChart/index.tsx`：移除硬编码 mock 数据，从 Redux store (`useModel('dataAnalysisEventModel')`) 读取 `data`、通过 `useQuery` 读取 `timeRange` 和 `eventInfoList`
- [x] 1.2 实现数据转换逻辑：使用 `useMemo` 将 `GenericEventAnalysisResult[]` 转换为 ECharts option（提取日期轴、按事件分组 series、计算指标值）
- [x] 1.3 处理空数据状态：当 `data` 为空或未查询时显示空状态提示
- [x] 1.4 保留 ECharts 初始化、resize 监听、tooltip/toolbox 等基础配置

## 2. 页面集成

- [x] 2.1 在 `event/index.tsx` 中取消 `<DataChart />` 的注释，重新启用图表组件
- [x] 2.2 确认 DataChart 渲染位置在 DataFilterConfigArea 和 DataTable 之间

## 3. 验证

- [x] 3.1 验证图表在有查询数据时正确渲染多事件折线对比
- [x] 3.2 验证空数据状态显示正确
- [x] 3.3 验证窗口 resize 时图表自适应