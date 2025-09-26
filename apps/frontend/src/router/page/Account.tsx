import type { IRouteItem } from "@router/type"
import { lazy } from "react"

export default [{
  name: '用户登录',
  key: 'login',
  path: '/login',
  component: lazy(() => import('@pages/account/login/index')),
  meta: {
    isHidden: true,
  },
}, {
  name: '用户注销',
  key: 'logout',
  path: '/logout',
  component: lazy(() => import('@pages/account/logout/index')),
  meta: {
    isHidden: true,
  },
}] as IRouteItem[]
