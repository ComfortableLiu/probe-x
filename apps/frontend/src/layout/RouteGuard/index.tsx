import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { IRouteGuardProps } from "@/layout/RouteGuard/type"
import { Localstorage } from "@utils/storage"
import { KEY_ACCESS_TOKEN } from "@/constant/storage"
import { usePathPermission } from "@/hooks/usePermission"
import { ROUTE_PATH_PERMISSION } from "@/constant/permissions"
import { RootState } from "@/store/storeContext"

// 白名单路径，不需要登录即可访问
const whiteList = ['/login']

const RouteGuard: React.FC<IRouteGuardProps> = ({ children }) => {
  const location = useLocation()
  const validPathPermission = usePathPermission()
  const permissionInfo = useSelector((store: RootState) => store.userModel.permissionInfo)

  // 检查当前路径是否在白名单中
  const isWhiteListed = whiteList.some(path => location.pathname === path)

  // 检查用户是否已登录，目前使用 localStorage
  const isLoggedIn = !!Localstorage.get<string>(KEY_ACCESS_TOKEN)

  // 渲染期判断：不在白名单且未登录时直接跳转登录页，不先渲染子树
  if (!isWhiteListed && !isLoggedIn) {
    const redirectUri = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?redirectUri=${redirectUri}`} replace />
  }

  // 系统配置等管理路由做页面权限校验，无权限跳回首页
  if (!isWhiteListed && location.pathname.startsWith('/system-config/')) {
    // 权限信息未加载完成时先不渲染，避免误判为无权限
    if (!permissionInfo) return null
    const permissionKey = ROUTE_PATH_PERMISSION[location.pathname] || Object.values(ROUTE_PATH_PERMISSION)
    if (!validPathPermission(location.pathname, permissionKey)) {
      return <Navigate to="/" replace />
    }
  }

  return <>{children}</>
}

export default RouteGuard
