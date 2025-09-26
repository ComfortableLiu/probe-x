import type { IRouteItem } from "@router/type"
import React, { lazy } from "react"
import { SettingOne } from "@icon-park/react"

export default {
  name: '系统设置',
  key: 'system-config',
  meta: {
    icon: <SettingOne theme="outline" size="16" fill="#333" />,
  },
  path: '/system-config',
  component: lazy(() => import('@pages/system-config/index')),
} as IRouteItem
