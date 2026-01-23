import type { IRouteItem } from "@router/type"
import React, { lazy } from "react"
import { Help } from "@icon-park/react"

export default {
  name: '系统说明',
  key: 'guide',
  path: '/guide',
  meta: {
    icon: <Help theme="outline" size="16" fill="rgba(255,255,255,0.65)" />,
    isHidden: true,
  },
  component: lazy(() => import('@pages/guide/index')),
  children: [
    {
      path: '',
      name: '使用说明首页',
      key: 'guide-index',
      component: lazy(() => import('@pages/guide/pages/index')),
      meta: {
        isHidden: true,
      },
    },
    // 数据分析说明
    {
      path: '/data-analysis/funnel',
      name: '漏斗分析说明',
      key: 'guide-data-analysis-funnel',
      component: lazy(() => import('@pages/guide/pages/data-analysis/funnel/index')),
      meta: {
        isHidden: true,
      },
    },
    {
      path: '/data-analysis/event',
      name: '事件分析说明',
      key: 'guide-data-analysis-event',
      component: lazy(() => import('@pages/guide/pages/data-analysis/event/index')),
      meta: {
        isHidden: true,
      },
    },
    {
      path: '/data-analysis/user-path',
      name: '用户路径分析说明',
      key: 'guide-data-analysis-user-path',
      component: lazy(() => import('@pages/guide/pages/data-analysis/user-path/index')),
      meta: {
        isHidden: true,
      },
    },
    {
      path: '/data-analysis/attribution',
      name: '归因分析说明',
      key: 'guide-data-analysis-attribution',
      component: lazy(() => import('@pages/guide/pages/data-analysis/attribution/index')),
      meta: {
        isHidden: true,
      },
    },
    {
      path: '/data-analysis/free',
      name: '自由分析说明',
      key: 'guide-data-analysis-free',
      component: lazy(() => import('@pages/guide/pages/data-analysis/free/index')),
      meta: {
        isHidden: true,
      },
    },
    {
      path: '/data-analysis/dashboard-config',
      name: '数据看板设置说明',
      key: 'guide-data-analysis-dashboard-config',
      component: lazy(() => import('@pages/guide/pages/data-analysis/dashboard-config/index')),
      meta: {
        isHidden: true,
      },
    },
    // 系统数据说明
    {
      path: '/system-data/overview',
      name: '系统数据总览说明',
      key: 'guide-system-data-overview',
      component: lazy(() => import('@pages/guide/pages/system-data/overview/index')),
      meta: {
        isHidden: true,
      },
    },
    {
      path: '/system-data/analysis',
      name: '系统数据分析说明',
      key: 'guide-system-data-analysis',
      component: lazy(() => import('@pages/guide/pages/system-data/analysis/index')),
      meta: {
        isHidden: true,
      },
    },
    // 点位管理说明
    {
      path: '/point-manage/spm',
      name: 'SPM管理说明',
      key: 'guide-point-manage-spm',
      component: lazy(() => import('@pages/guide/pages/point-manage/spm/index')),
      meta: {
        isHidden: true,
      },
    },
    {
      path: '/point-manage/scm',
      name: 'SCM管理说明',
      key: 'guide-point-manage-scm',
      component: lazy(() => import('@pages/guide/pages/point-manage/scm/index')),
      meta: {
        isHidden: true,
      },
    },
  ],
} as IRouteItem
