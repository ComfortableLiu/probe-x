import React, { memo, useMemo, useState } from "react"
import { Menu, MenuProps } from "antd"
import * as styles from "./styles.module.scss"
import { classnames } from "@utils/classnames"
import { allRoutes, allRoutesWithAliasMap } from "@/router"
import { MenuUnfoldOne } from "@icon-park/react"
import { Link } from "react-router"
import { useLocation } from "react-router-dom"

const MenuView = () => {

  const [collapsed, setCollapsed] = useState(false)

  type MenuItem = Required<MenuProps>['items'][number];

  const location = useLocation()

  // 当前选择的选项，根据路由展示的
  const selectedKeys = useMemo(() => allRoutesWithAliasMap.get(location.pathname).key, [location.pathname])

  const items: MenuItem[] = allRoutes.map(route => ({
    key: route.key,
    icon: route.meta?.icon,
    label: route.path ? <Link to={route.path}>{route.name}</Link> : route.name,
    children: route.children?.map(child => ({
      key: child.key,
      icon: child.meta?.icon,
      label: <Link to={child.path}>{child.name}</Link>,
    })),
  }))

  const switchCollapsed = () => {
    setCollapsed(!collapsed)
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
        selectedKeys={[selectedKeys]}
        items={items}
      />
      <div>
        <Menu
          className={classnames(styles.bottomMenu, styles.menu)}
          inlineCollapsed={collapsed}
          mode="inline"
          items={[{
            key: 'collapse',
            icon: <MenuUnfoldOne theme="outline" size="12" fill="#333" />,
            label: <span className={classnames({ collapsed })}>收起</span>,
            onClick: () => switchCollapsed(),
          }]}
        />
      </div>
    </div>
  )
}

export default memo(MenuView)
