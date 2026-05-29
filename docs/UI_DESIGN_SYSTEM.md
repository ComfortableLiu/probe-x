# Probe-X UI 设计规范

> 本规范适用于 Probe-X 前端所有页面开发，所有修改前端代码的 Agent（Claude Code、Codex、Cursor）必须遵循。

## 📐 设计 Token 系统

### 1. 颜色系统

#### 1.1 品牌色
```scss
// 主色 — 靛蓝（Indigo）
$color-primary: #3F51B5;
$color-primary-hover: #5465c7;
$color-primary-active: #2c3ea3;
$color-primary-bg: rgba(63, 81, 181, 0.06);
$color-primary-border: rgba(63, 81, 181, 0.3);

// 语义色
$color-success: #52c41a;
$color-success-bg: rgba(82, 196, 26, 0.1);
$color-warning: #faad14;
$color-warning-bg: rgba(250, 173, 20, 0.1);
$color-error: #ff4d4f;
$color-error-bg: rgba(255, 77, 79, 0.1);
$color-info: #3F51B5;
```

#### 1.2 中性色
```scss
// 文字颜色
$text-primary: rgba(0, 0, 0, 0.88);      // 主要文字
$text-secondary: rgba(0, 0, 0, 0.65);    // 次要文字
$text-tertiary: rgba(0, 0, 0, 0.45);     // 辅助文字
$text-quaternary: rgba(0, 0, 0, 0.25);   // 禁用文字

// 背景色
$bg-container: #ffffff;                   // 容器背景
$bg-elevated: #ffffff;                    // 浮层背景
$bg-layout: #f0f2f5;                      // 页面背景
$bg-spotlight: rgba(0, 0, 0, 0.85);      // 聚焦背景

// 边框色
$border-color: #d9d9d9;                   // 默认边框
$border-secondary: #f0f0f0;               // 次要边框
$split-color: rgba(5, 5, 5, 0.06);        // 分割线
```

#### 1.3 数据可视化色板
```scss
// ECharts 图表颜色（按顺序使用）
$chart-colors: (
  #3F51B5,  // 主色
  #52c41a,  // 成功
  #faad14,  // 警告
  #ff4d4f,  // 错误
  #13c2c2,  // 青色
  #722ed1,  // 紫色
  #eb2f96,  // 洋红
  #fa8c16,  // 橙色
  #a0d911,  // 青柠
  #2f54eb,  // 极客蓝
);
```

### 2. 字体系统

#### 2.1 字体族
```scss
$font-family-base: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
  'Helvetica Neue', Arial, 'Noto Sans', sans-serif, 'Apple Color Emoji',
  'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji';
$font-family-code: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo,
  Courier, monospace;
```

#### 2.2 字号
```scss
$font-size-xs: 12px;    // 辅助文字、标签
$font-size-sm: 13px;    // 小号文字
$font-size-base: 14px;  // 正文（默认）
$font-size-lg: 16px;    // 大号文字
$font-size-xl: 20px;    // 小号标题
$font-size-2xl: 24px;   // 页面标题
$font-size-3xl: 28px;   // 大号标题
```

#### 2.3 字重
```scss
$font-weight-regular: 400;    // 正文
$font-weight-medium: 500;     // 强调文字、按钮
$font-weight-semibold: 600;   // 标题
$font-weight-bold: 700;       // 重点强调
```

#### 2.4 行高
```scss
$line-height-tight: 1.25;     // 紧凑
$line-height-base: 1.5714;    // 默认
$line-height-loose: 1.6667;   // 宽松
```

### 3. 间距系统

基于 **4px 基准单位**，所有间距必须是 4 的倍数：

```scss
$spacing-xxs: 4px;    // 极小间距
$spacing-xs: 8px;     // 小间距
$spacing-sm: 12px;    // 中小间距
$spacing-base: 16px;  // 基础间距
$spacing-lg: 24px;    // 大间距
$spacing-xl: 32px;    // 特大间距
$spacing-xxl: 48px;   // 极大间距
```

### 4. 圆角系统

```scss
$radius-sm: 4px;      // 小组件（Tag、Badge）
$radius-base: 6px;    // 默认（Button、Input）
$radius-lg: 8px;      // 卡片、弹窗
$radius-xl: 12px;     // 大卡片
$radius-full: 9999px; // 圆形（Avatar）
```

### 5. 阴影系统

```scss
$shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.03),
  0 1px 6px -1px rgba(0, 0, 0, 0.02),
  0 2px 4px 0 rgba(0, 0, 0, 0.02);

$shadow-base: 0 6px 16px 0 rgba(0, 0, 0, 0.08),
  0 3px 6px -4px rgba(0, 0, 0, 0.12),
  0 9px 28px 8px rgba(0, 0, 0, 0.05);

$shadow-lg: 0 6px 16px 0 rgba(0, 0, 0, 0.08),
  0 3px 6px -4px rgba(0, 0, 0, 0.12),
  0 9px 28px 8px rgba(0, 0, 0, 0.05);
```

### 6. 动效系统

```scss
$motion-duration-fast: 0.1s;
$motion-duration-base: 0.2s;
$motion-duration-slow: 0.3s;

$motion-ease-in-out: cubic-bezier(0.645, 0.045, 0.355, 1);
$motion-ease-out: cubic-bezier(0.215, 0.61, 0.355, 1);
$motion-ease-in: cubic-bezier(0.55, 0.055, 0.675, 0.19);
```

---

## 🧱 布局系统

### 1. 整体布局

```
┌─────────────────────────────────────────┐
│                                         │
│  ┌──────────┬──────────────────────┐   │
│  │          │                      │   │
│  │  Sidebar │      Main Content    │   │
│  │  240px   │      flex: 1         │   │
│  │          │                      │   │
│  │          │                      │   │
│  └──────────┴──────────────────────┘   │
│                                         │
└─────────────────────────────────────────┘
```

- **侧边栏宽度**: 240px（展开）/ 64px（收起）
- **主内容区**: `flex: 1`，独立滚动
- **最小宽度**: 1000px（不支持窄屏）

### 2. 页面内边距

```scss
// 页面容器
.page-container {
  padding: $spacing-lg;  // 24px
  min-height: 100vh;
  background: $bg-layout;
}
```

### 3. 栅格系统

使用 Ant Design 24 栅格，常用配置：

```scss
// 表单项布局（一行 4 列）
Row gutter={[16, 8]}
Col span={6}

// 卡片布局（一行 3 列）
Row gutter={[24, 24]}
Col span={8}

// 两栏布局
Row gutter={24}
Col span={12}
```

---

## 📦 组件规范

### 1. 页面结构

#### 1.1 标准列表页
```tsx
<div className={styles.container}>
  <PageHeader title="页面标题" onRefresh={handleRefresh} />
  <FormComponent formItems={formItems} />
  <TableComponent dataSource={data} columns={columns} />
  <DetailDrawer open={open} onClose={handleClose} />
</div>
```

#### 1.2 标准分析页
```tsx
<div className={styles.container}>
  <DataAnalysisHeader title="分析标题" download={download} />
  <DataFilterConfigArea />
  <div className={styles.divider} />
  <DataChart />
  <div className={styles.divider} />
  <DataTable />
</div>
```

#### 1.3 标准详情页
```tsx
<div className={styles.container}>
  <PageHeader title="详情标题" extra={<Button>操作</Button>} />
  <Descriptions bordered column={2}>
    <Descriptions.Item label="字段1">值1</Descriptions.Item>
    <Descriptions.Item label="字段2">值2</Descriptions.Item>
  </Descriptions>
</div>
```

### 2. PageHeader 组件

**使用场景**: 所有页面顶部

```tsx
<PageHeader
  title="页面标题"           // 必填，字号 24px，字重 600
  onRefresh={handleRefresh} // 可选，刷新按钮
  loading={loading}         // 可选，加载状态
  extra={<>操作按钮</>}     // 可选，右侧操作区
/>
```

**样式规范**:
- 标题字号: `var(--px-font-size-2xl)` = 24px
- 标题字重: `var(--px-font-weight-semibold)` = 600
- 标题颜色: `var(--px-color-text-primary)`
- 底部间距: `var(--px-spacing-lg)` = 24px

### 3. TableComponent 组件

**使用场景**: 所有数据表格

```tsx
<TableComponent<T>
  dataSource={data}
  columns={columns}
  loading={loading}
  paginationData={{ total, current: page, pageSize }}
  size="small"
  scroll={{ x: 'max-content' }}
/>
```

**样式规范**:
- 默认尺寸: `size="small"`
- 分页配置: `pageSize=20`，启用 `showSizeChanger` + `showQuickJumper`
- 分页位置: `align="end"`（右对齐）
- 横向滚动: `scroll={{ x: 'max-content' }}`（必须）
- 表头背景: `var(--px-color-bg-container)` = #fafafa
- 边框颜色: `var(--px-color-border-secondary)` = #f0f0f0

### 4. FormComponent 组件

**使用场景**: 搜索表单、编辑表单

```tsx
<FormComponent<T>
  formItems={formItems}
  onFinish={handleFinish}
/>
```

**样式规范**:
- 布局: `Row gutter={[16, 8]}`
- 每列宽度: `Col span={6}`（一行 4 列）
- 提交按钮: 主色按钮 + 重置按钮
- 重置行为: 清空后自动提交

### 5. Card 组件

**使用场景**: 数据卡片、统计卡片

```tsx
<Card
  title="卡片标题"
  extra={<a>更多</a>}
  bordered={false}
>
  内容
</Card>
```

**样式规范**:
- 内边距: `var(--px-spacing-lg)` = 24px
- 圆角: `var(--px-radius-lg)` = 8px
- 阴影: `var(--px-shadow-sm)`
- 无边框: `bordered={false}`（推荐）

### 6. Button 组件

**使用场景**: 所有操作按钮

```tsx
<Button type="primary">主要操作</Button>
<Button type="default">次要操作</Button>
<Button type="text">文字操作</Button>
<Button type="link">链接操作</Button>
```

**样式规范**:
- 字重: `var(--px-font-weight-medium)` = 500
- 圆角: `var(--px-radius-base)` = 6px
- 主色: `var(--px-color-primary)`
- 间距: 多个按钮之间使用 `Space` 组件包裹，`size="middle"`

### 7. Modal 组件

**使用场景**: 确认弹窗、表单弹窗

```tsx
<Modal
  title="弹窗标题"
  open={open}
  onOk={handleOk}
  onCancel={handleCancel}
  destroyOnClose
>
  内容
</Modal>
```

**样式规范**:
- 圆角: `var(--px-radius-lg)` = 8px
- 阴影: `var(--px-shadow-base)`
- 默认宽度: 520px
- 必须: `destroyOnClose`（关闭时销毁内容）

### 8. Drawer 组件

**使用场景**: 详情抽屉、编辑抽屉

```tsx
<Drawer
  title="抽屉标题"
  open={open}
  onClose={handleClose}
  width={720}
  destroyOnClose
>
  内容
</Drawer>
```

**样式规范**:
- 默认宽度: 720px（详情）/ 480px（表单）
- 必须: `destroyOnClose`

### 9. Message 提示

**使用场景**: 操作反馈

```tsx
message.success('操作成功');
message.error('操作失败');
message.warning('请注意');
message.info('提示信息');
```

**样式规范**:
- 成功: `var(--px-color-success)`
- 失败: `var(--px-color-error)`
- 警告: `var(--px-color-warning)`
- 信息: `var(--px-color-info)`

### 10. Tag 组件

**使用场景**: 状态标签、分类标签

```tsx
<Tag color="success">成功</Tag>
<Tag color="processing">进行中</Tag>
<Tag color="warning">警告</Tag>
<Tag color="error">失败</Tag>
<Tag color="default">默认</Tag>
```

**样式规范**:
- 圆角: `var(--px-radius-sm)` = 4px
- 字号: `var(--px-font-size-xs)` = 12px

---

## 📊 数据可视化规范

### 1. ECharts 配置

#### 1.1 全局主题
```typescript
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import {
  BarChart,
  LineChart,
  PieChart,
  SankeyChart,
  FunnelChart,
} from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  DataZoomComponent,
  ToolboxComponent,
} from 'echarts/components'

use([
  CanvasRenderer,
  BarChart, LineChart, PieChart, SankeyChart, FunnelChart,
  GridComponent, TooltipComponent, LegendComponent,
  TitleComponent, DataZoomComponent, ToolboxComponent,
])
```

#### 1.2 通用配置模板
```typescript
const chartOption = {
  // 颜色
  color: [
    '#3F51B5', '#52c41a', '#faad14', '#ff4d4f', '#13c2c2',
    '#722ed1', '#eb2f96', '#fa8c16', '#a0d911', '#2f54eb',
  ],

  // 提示框
  tooltip: {
    trigger: 'axis',
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderColor: '#f0f0f0',
    borderWidth: 1,
    textStyle: {
      color: 'rgba(0, 0, 0, 0.88)',
      fontSize: 14,
    },
  },

  // 图例
  legend: {
    top: 0,
    textStyle: {
      color: 'rgba(0, 0, 0, 0.65)',
      fontSize: 12,
    },
  },

  // 网格
  grid: {
    left: 16,
    right: 16,
    top: 40,
    bottom: 16,
    containLabel: true,
  },

  // X 轴
  xAxis: {
    type: 'category',
    axisLine: { lineStyle: { color: '#d9d9d9' } },
    axisTick: { show: false },
    axisLabel: {
      color: 'rgba(0, 0, 0, 0.45)',
      fontSize: 12,
    },
  },

  // Y 轴
  yAxis: {
    type: 'value',
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: {
      color: 'rgba(0, 0, 0, 0.45)',
      fontSize: 12,
    },
    splitLine: {
      lineStyle: {
        color: '#f0f0f0',
        type: 'dashed',
      },
    },
  },
}
```

#### 1.3 响应式处理
```tsx
const chartRef = useRef<HTMLDivElement>(null)
const chartInstance = useRef<echarts.ECharts>()

useEffect(() => {
  if (!chartRef.current) return

  chartInstance.current = echarts.init(chartRef.current)
  chartInstance.current.setOption(chartOption)

  const handleResize = () => {
    chartInstance.current?.resize()
  }
  window.addEventListener('resize', handleResize)

  return () => {
    window.removeEventListener('resize', handleResize)
    chartInstance.current?.dispose()
  }
}, [chartOption])

return <div ref={chartRef} style={{ width: '100%', height: 400 }} />
```

### 2. 统计卡片（StatCards）

**布局规范**:
```
┌──────────┬──────────┬──────────┬──────────┐
│  指标1   │  指标2   │  指标3   │  指标4   │
│  数值    │  数值    │  数值    │  数值    │
│  趋势    │  趋势    │  趋势    │  趋势    │
└──────────┴──────────┴──────────┴──────────┘
```

**样式规范**:
- 布局: `Row gutter={[24, 24]}` + `Col span={6}`（一行 4 列）
- 卡片背景: `var(--px-color-bg-container)` = #ffffff
- 指标名称: `var(--px-font-size-sm)` = 13px，`var(--px-color-text-secondary)`
- 指标数值: `var(--px-font-size-3xl)` = 28px，`var(--px-font-weight-semibold)`
- 趋势图标: 上升绿色，下降红色
- 内边距: `var(--px-spacing-lg)` = 24px

### 3. 趋势图表（TrendChart）

**样式规范**:
- 容器高度: 400px
- 容器背景: `var(--px-color-bg-container)`
- 圆角: `var(--px-radius-lg)` = 8px
- 阴影: `var(--px-shadow-sm)`
- 内边距: `var(--px-spacing-lg)` = 24px

### 4. 数据表格（DataTable）

**样式规范**:
- 容器背景: `var(--px-color-bg-container)`
- 圆角: `var(--px-radius-lg)` = 8px
- 阴影: `var(--px-shadow-sm)`
- 内边距: `var(--px-spacing-lg)` = 24px
- 表格尺寸: `size="small"`

---

## 🎨 图标系统

### 1. 图标库

使用 `@icon-park/react`（字节跳动图标库）:

```tsx
import { Refresh, Me, User, Help, Logout, MenuUnfoldOne } from '@icon-park/react'

<Refresh theme="outline" size="16" fill="currentColor" />
```

### 2. 图标尺寸

```scss
$icon-size-xs: 12px;   // 小图标
$icon-size-sm: 16px;   // 默认图标
$icon-size-base: 20px; // 中等图标
$icon-size-lg: 24px;   // 大图标
$icon-size-xl: 32px;   // 特大图标
```

### 3. 图标颜色

```scss
// 默认继承文字颜色
fill="currentColor"

// 侧边栏图标（暗色背景）
fill="rgba(255, 255, 255, 0.65)"

// 操作按钮图标
fill="var(--px-color-text-secondary)"

// 激活状态图标
fill="var(--px-color-primary)"
```

---

## ✨ 动效规范

### 1. 页面切换

```scss
.page-enter {
  opacity: 0;
  transform: translateY(8px);
}
.page-enter-active {
  opacity: 1;
  transform: translateY(0);
  transition: opacity 0.3s, transform 0.3s;
}
```

### 2. 侧边栏折叠

```scss
.sidebar {
  width: 240px;
  transition: width $motion-duration-slow $motion-ease-in-out;

  &.collapsed {
    width: 64px;
  }
}
```

### 3. 卡片悬停

```scss
.card {
  transition: box-shadow $motion-duration-base $motion-ease-out,
              transform $motion-duration-base $motion-ease-out;

  &:hover {
    box-shadow: var(--px-shadow-base);
    transform: translateY(-2px);
  }
}
```

### 4. 按钮点击

```scss
.button {
  transition: all $motion-duration-fast $motion-ease-in-out;

  &:active {
    transform: scale(0.98);
  }
}
```

---

## 📱 响应式设计

### 1. 断点定义

```scss
$breakpoint-xs: 480px;   // 超小屏（不推荐）
$breakpoint-sm: 576px;   // 小屏
$breakpoint-md: 768px;   // 中屏
$breakpoint-lg: 992px;   // 大屏
$breakpoint-xl: 1200px;  // 超大屏
$breakpoint-xxl: 1600px; // 超超大屏
```

### 2. 响应式栅格

```tsx
<Row gutter={[16, 16]}>
  <Col xs={24} sm={12} md={8} lg={6}>
    <Card>内容</Card>
  </Col>
</Row>
```

### 3. 最小宽度限制

```scss
// 主内容区最小宽度
.app-router-view {
  min-width: 1000px;
}
```

---

## ♿ 无障碍设计

### 1. 颜色对比度

- 正文文字与背景对比度 ≥ 4.5:1
- 大文字（≥ 18px 或 14px 粗体）对比度 ≥ 3:1
- 交互元素与相邻颜色对比度 ≥ 3:1

### 2. 焦点管理

```scss
// 焦点样式（必须）
:focus-visible {
  outline: 2px solid var(--px-color-primary);
  outline-offset: 2px;
}
```

### 3. 键盘导航

- 所有交互元素必须可通过 Tab 键聚焦
- 使用 `Enter` 或 `Space` 触发操作
- 使用 `Escape` 关闭弹窗/菜单

### 4. ARIA 标签

```tsx
<Button aria-label="刷新数据">
  <Refresh />
</Button>

<Table aria-label="事件列表">
  ...
</Table>
```

---

## 🔧 文件组织

### 1. 页面目录结构

```
pages/
├── homepage/
│   ├── index.tsx              # 页面组件
│   ├── styles.module.scss     # 页面样式
│   ├── type.ts                # 类型定义
│   ├── model.ts               # Redux Model
│   ├── services.ts            # API 服务
│   └── components/            # 页面子组件
│       ├── StatCards/
│       │   ├── index.tsx
│       │   └── styles.module.scss
│       ├── TrendChart/
│       └── EventTable/
```

### 2. 样式文件命名

```scss
// ✅ 正确
styles.module.scss
component-name.module.scss

// ❌ 错误
style.scss          // 缺少 module
Component.module.scss // 不应大写
```

### 3. 类名生成规则

```scss
// CSS Modules 配置
localIdentName: '[name]__[local]--[hash:base64:5]'
exportLocalsConvention: 'camelCase'

// 使用
<div className={styles.pageContainer}>  // ✅ camelCase
<div className={styles['page-container']}> // ❌ 不推荐
```

---

## 🚫 禁止事项

### 1. 禁止硬编码颜色

```scss
// ❌ 禁止
color: #3F51B5;
background: #f0f2f5;
border: 1px solid #d9d9d9;

// ✅ 正确
color: var(--px-color-primary);
background: var(--px-color-bg-layout);
border: 1px solid var(--px-color-border);
```

### 2. 禁止硬编码间距

```scss
// ❌ 禁止
padding: 17px;
margin: 13px;
gap: 7px;

// ✅ 正确
padding: var(--px-spacing-base);
margin: var(--px-spacing-sm);
gap: var(--px-spacing-xs);
```

### 3. 禁止硬编码字号

```scss
// ❌ 禁止
font-size: 15px;
font-size: 11px;

// ✅ 正确
font-size: var(--px-font-size-lg);
font-size: var(--px-font-size-xs);
```

### 4. 禁止使用内联样式

```tsx
// ❌ 禁止
<div style={{ padding: 16, color: '#3F51B5' }}>

// ✅ 正确
<div className={styles.container}>
```

### 5. 禁止跳过响应式处理

```tsx
// ❌ 禁止 — 图表不处理 resize
const chart = echarts.init(container)
chart.setOption(option)

// ✅ 正确 — 监听 resize
useEffect(() => {
  const chart = echarts.init(container)
  chart.setOption(option)

  const handleResize = () => chart.resize()
  window.addEventListener('resize', handleResize)

  return () => {
    window.removeEventListener('resize', handleResize)
    chart.dispose()
  }
}, [])
```

---

## ✅ 检查清单

在提交代码前，请确认：

- [ ] 所有颜色使用 CSS 变量，无硬编码
- [ ] 所有间距是 4 的倍数
- [ ] 所有字号使用预定义值（xs/sm/base/lg/xl/2xl/3xl）
- [ ] 所有交互元素可通过键盘访问
- [ ] 所有图表监听 resize 事件
- [ ] 所有弹窗/抽屉设置 `destroyOnClose`
- [ ] 所有表格启用横向滚动 `scroll={{ x: 'max-content' }}`
- [ ] 所有按钮有明确的 loading 状态
- [ ] 所有表单有验证规则和错误提示
- [ ] 所有操作有 message 反馈

---

## 📚 参考资源

- **Ant Design 5 文档**: https://ant.design/components/overview-cn
- **ECharts 文档**: https://echarts.apache.org/zh/index.html
- **Icon Park 图标库**: https://iconpark.oceanengine.com/
- **CSS Modules 文档**: https://github.com/css-modules/css-modules
- **WCAG 2.1 无障碍指南**: https://www.w3.org/TR/WCAG21/

---

**最后更新**: 2026-05-29
**维护者**: Probe-X Design Team
