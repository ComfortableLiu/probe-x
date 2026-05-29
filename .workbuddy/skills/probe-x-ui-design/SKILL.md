---
name: probe-x-ui-design
version: 1.0.0
description: |
  Probe-X 前端 UI 设计规范。适用于所有前端页面的开发、修改和优化。
  确保 Claude Code、Codex、Cursor 等 Agent 在编写前端代码时遵循统一的设计标准，
  保持视觉一致性、代码质量和无障碍合规性。
triggers:
  - 修改前端页面
  - 新增前端组件
  - 调整页面样式
  - 创建新页面
  - 优化现有UI
  - 修改 Ant Design 主题
  - 数据可视化图表
  - 表单或表格组件
tags: [ui, design-system, frontend, react, antd, probe-x]
---

# Probe-X UI Design System Skill

## When to Use

本规范适用于以下场景（**任何对 `apps/frontend/src/` 目录下文件的修改都必须遵循**）：

- 新增或修改页面组件
- 新增或修改共享组件
- 调整布局、样式、颜色、间距
- 数据可视化图表开发
- 表单、表格等 CRUD 组件开发
- 修改 Ant Design 主题配置

## Project Context

Probe-X 是一个企业级 Web 数据分析平台，包含埋点管理、数据清洗、数据可视化分析功能。

### Tech Stack

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 19.x | UI 框架 |
| Ant Design | 5.26+ | 组件库 |
| TypeScript | 5.3+ | 类型安全 |
| Rspack | 1.4+ | 构建工具 |
| SCSS Modules | — | 样式方案 |
| ECharts | 6.x | 数据可视化 |
| @icon-park/react | 1.4+ | 图标库 |
| Rematch (Redux) | 2.2+ | 状态管理 |
| React Router | 7.x | 路由 |
| Emotion | 11.x | CSS-in-JS（辅助） |

### Key Paths

```
apps/frontend/
├── components/theme/themeConfig.ts    # Ant Design 主题 Token（唯一真相源）
├── public/design-tokens.css           # CSS Custom Properties（SCSS 中使用）
├── src/
│   ├── components/                    # 全局共享组件
│   │   ├── PageHeader/                # 页面标题
│   │   ├── TableComponent/            # 通用表格
│   │   ├── FormComponent/             # 动态表单
│   │   ├── Loading/                   # 全局加载
│   │   └── HoverBtn/                  # 悬浮按钮
│   ├── layout/                        # 布局（侧边栏 + 内容区）
│   ├── pages/                         # 页面目录
│   │   ├── homepage/                  # 首页看板
│   │   ├── point-manage/              # 埋点管理
│   │   ├── data-analysis/             # 数据分析
│   │   ├── system-data/               # 系统数据
│   │   └── system-config/             # 系统设置
│   ├── store/                         # Redux Store (Rematch models)
│   ├── hooks/                         # 自定义 Hooks
│   └── constant/                      # 常量定义
└── config/configuration.ts            # 环境配置
```

## Design Tokens

### Color System

#### Brand Colors
| Token | Value | Usage |
|-------|-------|-------|
| `--px-color-primary` | `#3F51B5` | 品牌主色（靛蓝） |
| `--px-color-primary-hover` | `#5465c7` | 主色悬停态 |
| `--px-color-primary-active` | `#2c3ea3` | 主色按下态 |
| `--px-color-primary-bg` | `rgba(63,81,181,0.06)` | 主色背景 |

#### Semantic Colors
| Token | Value | Usage |
|-------|-------|-------|
| `--px-color-success` | `#52c41a` | 成功状态 |
| `--px-color-warning` | `#faad14` | 警告状态 |
| `--px-color-error` | `#ff4d4f` | 错误/危险状态 |
| `--px-color-info` | `#3F51B5` | 信息状态（同主色） |

#### Neutral Colors
| Token | Value | Usage |
|-------|-------|-------|
| `--px-color-text-primary` | `rgba(0,0,0,0.88)` | 主要文字 |
| `--px-color-text-secondary` | `rgba(0,0,0,0.65)` | 次要文字 |
| `--px-color-text-tertiary` | `rgba(0,0,0,0.45)` | 辅助文字 |
| `--px-color-text-quaternary` | `rgba(0,0,0,0.25)` | 禁用文字 |
| `--px-color-bg-container` | `#ffffff` | 容器背景 |
| `--px-color-bg-layout` | `#f0f2f5` | 页面背景 |
| `--px-color-border` | `#d9d9d9` | 默认边框 |
| `--px-color-border-secondary` | `#f0f0f0` | 次要边框/分割线 |

### Typography

| Token | Value | Usage |
|-------|-------|-------|
| `--px-font-size-xs` | `12px` | 辅助文字、Tag、Badge |
| `--px-font-size-sm` | `13px` | 小号文字、指标名 |
| `--px-font-size-base` | `14px` | 正文（默认） |
| `--px-font-size-lg` | `16px` | 大号文字、小标题 |
| `--px-font-size-xl` | `20px` | 二级标题 |
| `--px-font-size-2xl` | `24px` | 页面标题 |
| `--px-font-size-3xl` | `28px` | 大数字指标 |

Font weights: `400`（正文）、`500`（强调/按钮）、`600`（标题）、`700`（重点）。

### Spacing (4px Base Unit)

| Token | Value | Usage |
|-------|-------|-------|
| `--px-spacing-xxs` | `4px` | 极小间距 |
| `--px-spacing-xs` | `8px` | 小间距 |
| `--px-spacing-sm` | `12px` | 中小间距 |
| `--px-spacing-base` | `16px` | 基础间距 |
| `--px-spacing-lg` | `24px` | 大间距（页面内边距） |
| `--px-spacing-xl` | `32px` | 特大间距 |
| `--px-spacing-xxl` | `48px` | 区域间分隔 |

### Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--px-radius-sm` | `4px` | Tag、Badge |
| `--px-radius-base` | `6px` | Button、Input |
| `--px-radius-lg` | `8px` | Card、Modal |
| `--px-radius-xl` | `12px` | 大卡片 |

### Shadows

| Token | Usage |
|-------|-------|
| `--px-shadow-sm` | 默认卡片、容器 |
| `--px-shadow-base` | Modal、Drawer、悬浮卡片 |

### Motion

| Token | Value |
|-------|-------|
| `--px-motion-duration-fast` | `0.1s` |
| `--px-motion-duration-base` | `0.2s` |
| `--px-motion-duration-slow` | `0.3s` |

---

## Layout Rules

### Overall Structure

```
flex-row
├── Sidebar (width: 240px / 64px collapsed, bg: #001529)
└── Main Content (flex: 1, overflow: auto, min-width: 1000px)
```

### Page Container Pattern

Every page MUST use this container structure:

```scss
.container {
  padding: var(--px-spacing-lg);  // 24px
  min-height: 100vh;
  background: var(--px-color-bg-layout);
}
```

### Grid System

Use Ant Design 24-column grid:
- Form fields: `Row gutter={[16, 8]}` + `Col span={6}` → 4 columns per row
- Stat cards: `Row gutter={[24, 24]}` + `Col span={6}` → 4 cards per row
- Chart grid: `Row gutter={[24, 24]}` + `Col span={12}` or `span={8}`

---

## Component Patterns

### Standard List Page (CRUD)

```tsx
<div className={styles.container}>
  <PageHeader title="标题" onRefresh={handleRefresh} loading={loading.xxx} />
  <FormComponent formItems={formItems} />
  <TableComponent<T>
    dataSource={list}
    columns={columns}
    loading={loading.xxx}
    paginationData={{ total, current: page, pageSize }}
  />
  <DetailDrawer open={!!selected} onClose={() => setSelected(null)} />
</div>
```

### Standard Analysis Page

```tsx
<div className={styles.container}>
  <DataAnalysisHeader title="分析名称" download={download} onSaveAsDashboard={save} />
  <DataFilterConfigArea />
  <div className={styles.divider} />
  <DataChart />
  <div className={styles.divider} />
  <DataTable />
</div>
```

### Divider Between Sections

```scss
.divider {
  width: 100%;
  height: 1px;
  background-color: var(--px-color-border-secondary);
}
```

### ECharts Setup

```typescript
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
// ... import charts/components and register with use([...])

// ALWAYS add resize listener
useEffect(() => {
  const chart = echarts.init(containerRef.current!)
  chart.setOption(option)
  const handleResize = () => chart.resize()
  window.addEventListener('resize', handleResize)
  return () => {
    window.removeEventListener('resize', handleResize)
    chart.dispose()
  }
}, [option])
```

Chart color palette (in order):
```
#3F51B5, #52c41a, #faad14, #ff4d4f, #13c2c2,
#722ed1, #eb2f96, #fa8c16, #a0d911, #2f54eb
```

### Icons

Use `@icon-park/react`. Always use `fill="currentColor"` unless in sidebar (`fill="rgba(255,255,255,0.65)"`).

---

## State Management

All state uses Rematch models co-located with their pages:

```
pages/{module}/{page}/
├── index.tsx        # Page component
├── model.ts         # Rematch model (state + reducers + effects)
├── services.ts      # API calls
├── type.ts          # TypeScript types
├── styles.module.scss
└── components/      # Sub-components
```

Custom hooks:
- `useModel<T>(modelName)` — Get typed model state from Redux
- `useLoading()` — Get loading states per model/action
- `useQuery<T>()` — Read URL query params
- `useRouter()` — Navigate + `refresh()` to sync query params
- `useHistoryListener(cb)` — Listen to route changes

---

## Style Rules

### SCSS Module Only

All styles MUST be in `.module.scss` files. No inline styles. No global CSS classes.

```scss
// Import design tokens via CSS variables (available globally via design-tokens.css)
.container {
  padding: var(--px-spacing-lg);
  background: var(--px-color-bg-layout);
}

.title {
  font-size: var(--px-font-size-2xl);
  font-weight: var(--px-font-weight-semibold);
  color: var(--px-color-text-primary);
}
```

### Class Naming

CSS Modules auto-generate names as `[name]__[local]--[hash]`, exported as camelCase:
```tsx
<div className={styles.pageContainer}>     {/* ✅ */}
<div className={styles['page-container']}> {/* ❌ avoid */}
```

### File Naming Conventions

| Type | Pattern | Example |
|------|---------|---------|
| Component | PascalCase directory + `index.tsx` | `StatCards/index.tsx` |
| Styles | `styles.module.scss` | `StatCards/styles.module.scss` |
| Types | `type.ts` | `event/type.ts` |
| Model | `model.ts` | `event/model.ts` |
| Services | `services.ts` | `event/services.ts` |

---

## Hard Rules (MUST Follow)

1. **No hardcoded colors** — Always use `var(--px-color-*)` or Ant Design tokens
2. **Spacing must be multiples of 4px** — No 13px, 17px, etc.
3. **Font sizes from predefined set** — xs(12), sm(13), base(14), lg(16), xl(20), 2xl(24), 3xl(28)
4. **All modals/drawers need `destroyOnClose`** — Prevent stale state
5. **Tables need `scroll={{ x: "max-content" }}`** — Enable horizontal scroll
6. **Charts must listen to `window.resize`** — And call `chart.resize()`
7. **Focus styles required** — `:focus-visible { outline: 2px solid var(--px-color-primary); outline-offset: 2px; }`
8. **Touch targets ≥ 44px** — For interactive elements
9. **All operations need feedback** — `message.success()` / `message.error()` after actions
10. **Loading states required** — Every async operation shows `<Spin>` or button `loading` prop

## Existing Pages Reference

| Route | Name | Pattern |
|-------|------|---------|
| `/` | 首页看板 | Dashboard (StatCards + TrendChart + EventTable) |
| `/point-manage/event` | 事件管理 | CRUD List (FormComponent + TableComponent + Detail) |
| `/point-manage/property` | 属性管理 | CRUD List |
| `/point-manage/spm` | SPM管理 | Tree CRUD (4-level hierarchy) |
| `/point-manage/scm` | SCM管理 | Tree CRUD (4-level hierarchy) |
| `/point-manage/basic-coding` | 基础编码 | CRUD List |
| `/data-analysis/event` | 事件分析 | Analysis (FilterConfig + Chart + Table) |
| `/data-analysis/funnel` | 漏斗分析 | Analysis (Funnel visualization) |
| `/data-analysis/free` | 自由分析 | Self-service BI (3-column layout) |
| `/data-analysis/userPath` | 用户路径 | Analysis (Sankey diagram) |
| `/data-analysis/attribution` | 归因分析 | Analysis (Pie + Bar + Funnel charts) |
| `/data-analysis/dashboardConfig` | 看板设置 | Config page |
| `/system-data/overview` | 系统总览 | Dashboard |
| `/system-data/analysis` | 数分数据 | Monitoring dashboard |
| `/system-data/meta` | 元数据 | Data pipeline monitoring |
| `/system-data/computingNode` | 计算节点 | Node management |
| `/system-config/*` | 系统设置 | Various CRUD configs |

## Additional Resources

- Full design spec: `docs/UI_DESIGN_SYSTEM.md`
- Theme config: `components/theme/themeConfig.ts`
- CSS tokens: `public/design-tokens.css`
- Permissions system: `src/constant/permissions.ts`
- Roles: SUPER_ADMIN, ADMIN, DEVELOPER, DATA_ANALYST
