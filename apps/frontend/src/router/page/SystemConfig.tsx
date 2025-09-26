import type { IRouteItem } from "@router/type"
import React from "react"
import { SettingOne } from "@icon-park/react"

export default {
  name: '系统设置',
  key: 'system-data',
  meta: {
    icon: <SettingOne theme="outline" size="16" fill="#333" />,
  },
  path: '/system-config',
} as IRouteItem
