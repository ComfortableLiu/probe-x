import type { IRouteItem } from "./type"
import React, { lazy } from "react"
import { Home } from "@icon-park/react"
import routePages from "./page"

const homepageRoutes: IRouteItem = {
  path: '/',
  name: '首页',
  key: 'homepage',
  alias: ['/home', '/homepage', '/index'],
  component: lazy(() => import('@pages/homepage/index')),
  meta: {
    icon: <Home theme="outline" size="16" fill="#333" />,
  },
}

export const allRoutes = [
  homepageRoutes,
  ...routePages,
]

// 用来做path=>item的映射的，同时包括一级和二级菜单，并同时包括别名
export const allRoutesWithAliasMap: Map<string, IRouteItem> = allRoutes.reduce((previousValue, currentValue) => {
  previousValue.set(currentValue.path, currentValue);
  (currentValue.alias || []).forEach(alias => previousValue.set(alias, currentValue))
  if (currentValue.children) {
    currentValue.children.forEach((route) => {
      previousValue.set(`${currentValue.path || ''}${route.path}`, route);
      (route.alias || []).forEach(alias => previousValue.set(`${currentValue.path || ''}${alias}`, currentValue))
    })
  }
  return previousValue
}, new Map<string, IRouteItem>())

// 用来做path=>item的映射的，同时包括一级和二级菜单
export const allRoutesMap: Map<string, IRouteItem> = allRoutes.reduce((previousValue, currentValue) => {
  previousValue.set(currentValue.path, currentValue)
  if (currentValue.children) {
    currentValue.children.forEach((route) => {
      previousValue.set(`${currentValue.path || ''}${route.path}`, route)
    })
  }
  return previousValue
}, new Map<string, IRouteItem>())

// 功能同上，但是只包括带页面的路由
export const flatRoutes = allRoutes.reduce((previousValue, currentValue) => {
  if (currentValue.component) {
    previousValue.set(currentValue.path, currentValue)
  }
  if (currentValue.children) {
    currentValue.children.forEach((route: IRouteItem) => {
      if (!route.component) return
      previousValue.set(`${currentValue.path || ''}${route.path}`, route)
    })
  }
  return previousValue
}, new Map<string, IRouteItem>())

// 扁平化路由，用来注册用，实际业务中是需要有父子路由的，所以这个实际业务中没有用
export const routes: IRouteItem[] = allRoutes.reduce<IRouteItem[]>((previousValue, currentValue: IRouteItem) => {
  const list: IRouteItem[] = []
  if (currentValue.component) {
    const alias = [...(currentValue.alias || [])].reduce<`/${string}`[]>((p, c) => {
      const l = [...p, c]
      if (c !== '/') {
        l.push(`${c}.html`)
      }
      return l
    }, [])
    if (currentValue.path !== '/') {
      alias.push(`${currentValue.path}.html`)
    }
    list.push({
      ...currentValue,
      alias,
    })
  }
  if (currentValue.children) {
    currentValue.children.forEach((route) => {
      if (!route.component) return
      const path: `/${string}` = `${currentValue.path || ''}${route.path}`
      list.push({
        ...route,
        path,
        alias: [...(route.alias || []), path + '.html'] as `/${string}`[],
      })
    })
  }
  return [...previousValue, ...list]
}, [])
