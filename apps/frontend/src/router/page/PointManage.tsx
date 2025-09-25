import type { IRouteItem } from "@router/type"
import React, { lazy } from "react"
import { PageTemplate } from "@icon-park/react"

export default {
  name: '埋点管理',
  key: 'point-manage',
  meta: {
    icon: <PageTemplate theme="outline" size="16" fill="#333" />,
  },
  children: [{
    path: '/point-manage/spm',
    name: 'SPM管理',
    key: 'point-manage-report',
    component: lazy(() => import('@pages/point-manage/spm/index')),
  }, {
    path: '/point-manage/scm',
    name: 'SCM管理',
    key: 'point-manage-scm',
    component: lazy(() => import('@pages/point-manage/scm/index')),
  }],
} as IRouteItem
