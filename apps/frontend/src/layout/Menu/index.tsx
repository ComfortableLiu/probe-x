import React, { memo, useState } from "react"
import { Menu, MenuProps } from "antd"
import * as styles from "./styles.module.scss"
import { classnames } from "@utils/classnames"
import { allRoutes } from "@/router"
import { MenuUnfoldOne } from "@icon-park/react"

const MenuView = () => {

  const [collapsed, setCollapsed] = useState(false)

  type MenuItem = Required<MenuProps>['items'][number];

  const items: MenuItem[] = allRoutes.map(route => ({
    key: route.key,
    icon: route.meta?.icon,
    label: route.name,
    children: route.children?.map(child => ({
      key: child.key,
      icon: child.meta?.icon,
      label: child.name,
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
