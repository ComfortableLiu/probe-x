import type { IRouteItem } from "@router/type"
import React, { lazy } from "react"
import { InternalData } from "@icon-park/react"

export default {
  name: '系统数据',
  key: 'system-data',
  meta: {
    icon: <InternalData theme="outline" size="16" fill="rgba(255,255,255,0.65)" />,
  },
  children: [{
    path: '/system-data/overview',
    name: '总览',
    key: 'system-data-overview',
    component: lazy(() => import('@pages/system-data/overview/index')),
  }, {
    path: '/system-data/analysis',
    name: '数分数据',
    key: 'system-data-analysis',
    component: lazy(() => import('@pages/system-data/analysis/index')),
  }, {
    path: '/system-data/meta',
    name: '元数据',
    key: 'system-data-meta',
    component: lazy(() => import('@pages/system-data/meta/index')),
  }, {
    path: '/system-data/computingNode',
    name: '计算节点',
    key: 'system-data-computing-node',
    component: lazy(() => import('@pages/system-data/computing-node/index')),
  }],
} as IRouteItem
