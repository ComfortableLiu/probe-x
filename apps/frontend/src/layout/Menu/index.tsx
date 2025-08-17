import React, { Fragment, memo, useEffect, useMemo } from "react";
import { allRoutes, allRoutesMap } from "@/router";
import { IRouteItem } from "@router/type.ts";
import { classnames } from "@utils/classnames.ts";
import * as styles from "./styles.module.scss"
import { Link, useLocation } from "react-router";
import { Dropdown, MenuProps } from "antd";
import { handleHead, maintainFrequentRouteHistory, manageRouteHistory } from "@utils/router.ts";

const MenuView = () => {

  const location = useLocation()

  const handleRouter = (path: string) => {
    // 维护最近历史记录
    manageRouteHistory(path as `/${string}`)
    // 维护高频路由历史记录
    maintainFrequentRouteHistory(path as `/${string}`)
  }

  useEffect(() => {
    handleRouter(location.pathname)
  }, [location.pathname])

  const metadata = useMemo(() => handleHead(allRoutesMap.get(location.pathname)), [location.pathname])

  // 现在选择的一级菜单
  const selectedFirstMenu = useMemo(() => allRoutesMap.get(`/${location.pathname.split('/')[1]}`), [location.pathname])
  // 现在选择的二级菜单
  const selectedSecondMenu = useMemo(() => allRoutesMap.get(location.pathname), [location.pathname])

  // 一级菜单
  const firstMenuView = useMemo(() => {
    // 一级列表
    const list = allRoutes.map((route) => {
      const items: MenuProps['items'] = (route.children || []).map((children: IRouteItem) => {
        const href = `${route.path || ''}${children.path}`
        return {
          key: children.key,
          label: (
            <Link
              to={href}
              className={classnames(styles.linkA, {
                [styles.active]: selectedFirstMenu?.key === route.key
              })}
            >
              {children.name}
            </Link>
          ),
        }
      })

      const href = route.children ? `${route.path}${route.children[0].path}` : route.path
      return (
        <Dropdown
          key={route.key}
          menu={{ items }}
        >
          <Link
            to={href}
            className={classnames(styles.linkA, {
              [styles.active]: selectedFirstMenu?.key === route.key
            })}
          >
            {route.name}
          </Link>
        </Dropdown>
      )
    })

    // 容器
    return (
      <div className={styles.content}>
        {list}
      </div>
    )
  }, [selectedFirstMenu?.key])

  // 二级菜单
  const secondMenuView = useMemo(() => {
    const list = (selectedFirstMenu?.children || []).map(route => {
      const href = `${selectedFirstMenu?.path || ''}${route.path}`
      return (
        <Link
          to={href}
          key={route.key}
          className={classnames(styles.linkA, {
            [styles.active]: selectedSecondMenu?.key === route.key
          })}
        >
          {route.name}
        </Link>
      )
    })

    return (
      <div className={styles.content}>
        {list}
      </div>
    )
  }, [selectedFirstMenu?.children, selectedFirstMenu?.path, selectedSecondMenu?.key])

  return (
    <Fragment>
      <title>{metadata.title || ''}</title>
      <meta name="description" content={metadata.description || ''} />
      <meta name="keywords" content={metadata.keywords || ''} />
      <div className={styles.menu}>
        <div className={styles.menuFirst}>
          {firstMenuView}
        </div>
        {selectedFirstMenu?.children ?
          <div className={styles.menuSecond}>
            {secondMenuView}
          </div>
          : null}
      </div>
    </Fragment>
  )
}

export default memo(MenuView)
