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
    path: '/point-manage/attribute',
    name: '属性管理',
    key: 'point-manage-attribute',
    component: lazy(() => import('@pages/point-manage/attribute/index')),
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
    path: '/point-manage/businessDomain',
    name: '业务域管理',
    key: 'point-manage-business-domain',
    component: lazy(() => import('@pages/point-manage/business-domain/index')),
  }],
} as IRouteItem
