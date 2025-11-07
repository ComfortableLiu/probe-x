import React, { memo, useMemo, useState } from "react"
import { Menu, MenuProps } from "antd"
import * as styles from "./styles.module.scss"
import { classnames } from "@utils/classnames"
import { allRoutes, allRoutesWithAliasMap } from "@/router"
import { Me, MenuUnfoldOne } from "@icon-park/react"
import { Link } from "react-router"
import { useLocation } from "react-router-dom"
import ssoAuth from "@/lib/request/sso/ssoAuth"
import { useModel } from "@/hooks"
import { IUserModel } from "@/store/models/user/type"

const MenuView = () => {

  const [collapsed, setCollapsed] = useState(false)

  type MenuItem = Required<MenuProps>['items'][number];

  const location = useLocation()

  const { userInfo } = useModel<IUserModel>('userModel')

  // 假设登录页路径为 /login，根据实际情况调整
  const isLoginPage = location.pathname === '/login'

  // 当前选择的选项，根据路由展示的
  const selectedKeys = useMemo(() => allRoutesWithAliasMap.get(location.pathname).key, [location.pathname])

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
        theme="dark"
        selectedKeys={[selectedKeys]}
        items={items}
      />
      <div>
        <Menu
          className={styles.menu}
          inlineCollapsed={collapsed}
          mode="vertical"
          theme="dark"
          items={[{
            key: 'account',
            icon: <Me theme="outline" size="16" fill="rgba(255,255,255,0.65)" />,
            label: <span className={classnames({ collapsed })}>{userInfo.nickname || userInfo.username}</span>,
            children: [{
              key: 'account-center',
              label: (
                <Link to="/account">
                  <span className={classnames({ collapsed })}>个人中心</span>
                </Link>
              ),
            }, {
              key: 'logout',
              label: <span className={classnames({ collapsed })}>退出登录</span>,
              onClick: () => ssoAuth.gotoLoginPage(),
            }],
          }, {
            key: 'collapse',
            icon: <MenuUnfoldOne theme="outline" size="16" fill="rgba(255,255,255,0.65)" />,
            label: <span className={classnames({ collapsed })}>收起</span>,
            onClick: () => switchCollapsed(),
          }]}
        />
      </div>
    </div>
  )
}

export default memo(MenuView)
