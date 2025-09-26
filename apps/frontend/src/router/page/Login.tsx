import type { IRouteItem } from "@router/type"
import { lazy } from "react"

export default {
  name: '用户登录',
  key: 'login',
  path: '/login',
  component: lazy(() => import('@pages/login/index')),
  meta: {
    isHidden: true,
  },
} as IRouteItem
