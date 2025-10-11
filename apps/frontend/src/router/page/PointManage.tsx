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
    path: '/point-manage/event',
    name: '事件管理',
    key: 'point-manage-event',
    component: lazy(() => import('@pages/point-manage/event/index')),
  }, {
    path: '/point-manage/property',
    name: '属性管理',
    key: 'point-manage-property',
    component: lazy(() => import('@pages/point-manage/property/index')),
  }, {
    path: '/point-manage/spm',
    name: 'SPM管理',
    key: 'point-manage-spm',
    component: lazy(() => import('@pages/point-manage/spm/index')),
  }, {
    path: '/point-manage/scm',
    name: 'SCM管理',
    key: 'point-manage-scm',
    component: lazy(() => import('@pages/point-manage/scm/index')),
  }, {
    path: '/point-manage/scm/detail',
    name: 'SCM详情',
    key: 'point-manage-scm-detail',
    component: lazy(() => import('@pages/point-manage/scm/components/detail/index')),
    meta: {
      isHidden: true,
    },
  }, {
    path: '/point-manage/basic-coding',
    name: '基础编码管理',
    key: 'point-manage-basic-coding',
    component: lazy(() => import('@pages/point-manage/basic-coding/index')),
  }],
} as IRouteItem
