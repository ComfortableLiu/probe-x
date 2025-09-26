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
  name: '个人中心',
  key: 'account-center',
  path: '/account',
  component: lazy(() => import('@pages/account/account-center/index')),
  meta: {
    isHidden: true,
  },
}] as IRouteItem[]
