import type { IRouteItem } from "@router/type"
import React, { lazy } from "react"
import { ChartPieOne } from "@icon-park/react"

export default {
  name: '数据分析',
  key: 'data-analysis',
  meta: {
    icon: <ChartPieOne theme="outline" size="16" fill="#333" />,
  },
  children: [{
    path: '/data-analysis/event',
    name: '事件分析',
    key: 'data-analysis-event',
    component: lazy(() => import('@pages/data-analysis/event/index')),
  }, {
    path: '/data-analysis/funnel',
    name: '漏斗分析',
    key: 'data-analysis-funnel',
    component: lazy(() => import('@pages/data-analysis/funnel/index')),
  }, {
    path: '/data-analysis/free',
    name: '自由分析',
    key: 'data-analysis-free',
    component: lazy(() => import('@pages/data-analysis/free/index')),
  }, {
    path: '/data-analysis/userPath',
    name: '用户路径分析',
    key: 'data-analysis-user-path',
    component: lazy(() => import('@pages/data-analysis/user-path/index')),
  }, {
    path: '/data-analysis/attribution',
    name: '归因分析',
    key: 'data-analysis-attribution',
    component: lazy(() => import('@pages/data-analysis/attribution/index')),
  }, {
    path: '/data-analysis/dashboardConfig',
    name: '看板设置',
    key: 'data-analysis-dashboard-config',
    component: lazy(() => import('@pages/data-analysis/dashboard-config/index')),
  }],
} as IRouteItem
