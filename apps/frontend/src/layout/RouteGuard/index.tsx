import React, { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { IRouteGuardProps } from "@/layout/RouteGuard/type"
import { Localstorage } from "@utils/storage"
import { KEY_ACCESS_TOKEN } from "@/constant/storage"

// 白名单路径，不需要登录即可访问
const whiteList = ['/login']

const RouteGuard: React.FC<IRouteGuardProps> = ({ children }) => {
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    // 检查当前路径是否在白名单中
    const isWhiteListed = whiteList.some(path => location.pathname === path)

    // 这里应该检查用户是否已登录，目前使用 localStorage
    const isLoggedIn = !!Localstorage.get<string>(KEY_ACCESS_TOKEN)

    // 如果不在白名单且未登录，则重定向到登录页
    if (!isWhiteListed && !isLoggedIn) {
      navigate('/login', { replace: true })
    }
  }, [location, navigate])

  return <>{children}</>
}

export default RouteGuard
