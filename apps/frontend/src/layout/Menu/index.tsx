import React, { memo, useEffect, useMemo, useRef, useState } from "react"
import { Menu, MenuProps } from "antd"
import * as styles from "./styles.module.scss"
import { classnames } from "@utils/classnames"
import { allRoutes, allRoutesWithAliasMap } from "@/router"
import { Help, Logout, Me, MenuUnfoldOne, User } from "@icon-park/react"
import { Link } from "react-router"
import { useLocation } from "react-router-dom"
import ssoAuth from "@/lib/request/sso/ssoAuth"
import { useModel } from "@/hooks"
import { IUserModel } from "@/store/models/user/type"
import type { IRouteItem } from "@/router/type"

const MenuView = () => {

  const [collapsed, setCollapsed] = useState(false)
  const [openKeys, setOpenKeys] = useState<string[]>([])
  // 标记是否已经初始化过 openKeys（只在首次加载时自动展开）
  const isInitializedRef = useRef(false)

  type MenuItem = Required<MenuProps>['items'][number];

  const location = useLocation()

  const { userInfo } = useModel<IUserModel>('userModel')

  // 假设登录页路径为 /login，根据实际情况调整
  const isLoginPage = location.pathname === '/login'

  // 当前选择的选项，根据路由展示的
  const selectedKeys = useMemo(() => allRoutesWithAliasMap.get(location.pathname)?.key, [location.pathname])

  // 只在首次加载时根据当前路由自动展开对应的一级目录
  useEffect(() => {
    if (isLoginPage || isInitializedRef.current) return

    const currentPath = location.pathname
    const currentRoute = allRoutesWithAliasMap.get(currentPath)
    if (!currentRoute) {
      isInitializedRef.current = true
      return
    }

    // 查找当前路由对应的一级父路由
    let parentRoute: IRouteItem | undefined

    // 遍历所有一级路由，查找包含当前路由的父路由
    for (const route of allRoutes) {
      if (!route.children || route.children.length === 0) continue

      // 方法1: 通过 key 匹配（最准确）
      const isChildRoute = route.children.some(child => child.key === currentRoute.key)

      if (isChildRoute) {
        parentRoute = route
        break
      }

      // 方法2: 通过路径匹配（备用方案）
      const routePath = route.path || ''
      if (currentPath.startsWith(routePath) && currentPath !== routePath) {
        const isChildRouteByPath = route.children.some(child => {
          const childPath = `${routePath}${child.path}`
          // 检查完整路径是否匹配
          if (childPath === currentPath) return true
          // 检查别名是否匹配
          if (child.alias?.some(alias => `${routePath}${alias}` === currentPath)) return true
          return false
        })

        if (isChildRouteByPath) {
          parentRoute = route
          break
        }
      }
    }

    // 如果找到父路由，设置 openKeys（只在首次加载时）
    if (parentRoute) {
      setOpenKeys([parentRoute.key])
    }

    // 标记已初始化，之后不再自动更新
    isInitializedRef.current = true
  }, [location.pathname, isLoginPage])

  const items: MenuItem[] = allRoutes.filter(route => !route.meta.isHidden).map(route => ({
    key: route.key,
    icon: route.meta?.icon,
    label: route.path ? <Link to={route.path}>{route.name}</Link> : route.name,
    children: route.children ? route.children.filter(route => !route.meta?.isHidden).map(child => ({
      key: child.key,
      icon: child.meta?.icon,
      label: <Link to={child.path}>{child.name}</Link>,
    })) : null,
  }))

  const switchCollapsed = () => {
    setCollapsed(!collapsed)
  }

  if (isLoginPage) {
    return null
  }

  return (
    <div
      className={classnames(styles.sider, {
        [styles.collapsed]: collapsed,
      })}
    >
      <Menu
        className={styles.menu}
        inlineCollapsed={collapsed}
        mode="inline"
        selectedKeys={selectedKeys ? [selectedKeys] : []}
        openKeys={openKeys}
        onOpenChange={setOpenKeys}
        items={items}
      />
      <div>
        <Menu
          className={styles.menu}
          inlineCollapsed={collapsed}
          mode="vertical"
          items={[{
            key: 'account',
            icon: <Me theme="outline" size="16" fill="currentColor" />,
            label: <span className={classnames({ collapsed })}>{userInfo?.nickname || userInfo?.username || '未知'}</span>,
            children: [{
              key: 'account-center',
              icon: <User theme="outline" size="16" fill="currentColor" />,
              label: (
                <Link to="/account">
                  <span className={classnames({ collapsed })}>个人中心</span>
                </Link>
              ),
            }, {
              key: 'guide',
              icon: <Help theme="outline" size="16" fill="currentColor" />,
              label: (
                <Link to="/guide">
                  <span className={classnames({ collapsed })}>系统说明</span>
                </Link>
              ),
            }, {
              key: 'logout',
              icon: <Logout theme="outline" size="16" fill="currentColor" />,
              label: <span className={classnames({ collapsed })}>退出登录</span>,
              onClick: () => ssoAuth.gotoLoginPage(),
            }],
          }, {
            key: 'collapse',
            icon: <MenuUnfoldOne theme="outline" size="16" fill="currentColor" />,
            label: <span className={classnames({ collapsed })}>收起</span>,
            onClick: () => switchCollapsed(),
          }]}
        />
      </div>
    </div>
  )
}

export default memo(MenuView)
