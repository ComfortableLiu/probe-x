import type { IRouteItem } from "@router/type"
import React, { lazy } from "react"
import { Dashboard } from "@icon-park/react"

export default {
  path: '/dashboard',
  name: '看板',
  key: 'dashboard',
  component: lazy(() => import('@pages/dashboard/index')),
  meta: {
    icon: <Dashboard theme="outline" size="16" fill="currentColor" />,
  },
} as IRouteItem
