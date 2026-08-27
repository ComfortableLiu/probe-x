import React, { lazy, Suspense, useMemo } from "react"
import { Outlet, useLocation, useNavigate } from "react-router-dom"
import { Card, Menu, MenuProps } from "antd"
import { FileTextOutlined } from "@ant-design/icons"
import PageHeader from "@components/PageHeader"
import Loading from "@components/Loading"
import * as styles from "./styles.module.scss"

const GuideIndex = lazy(() => import('./pages/index'))

// 说明页目录结构
const guideMenuItems: Array<{
  key: string
  label: string
  path: string
  children?: Array<{
    key: string
    label: string
    path: string
    children?: Array<{
      key: string
      label: string
      path: string
    }>
  }>
}> = [
  {
    key: 'data-analysis',
    label: '数据分析',
    path: '/guide/data-analysis',
    children: [
      {
        key: 'funnel',
        label: '漏斗分析',
        path: '/guide/data-analysis/funnel',
      },
      {
        key: 'event',
        label: '事件分析',
        path: '/guide/data-analysis/event',
      },
      {
        key: 'user-path',
        label: '用户路径分析',
        path: '/guide/data-analysis/user-path',
      },
      {
        key: 'attribution',
        label: '归因分析',
        path: '/guide/data-analysis/attribution',
      },
      {
        key: 'dashboard-config',
        label: '数据看板设置',
        path: '/guide/data-analysis/dashboard-config',
      },
    ],
  },
  {
    key: 'system-data',
    label: '系统数据',
    path: '/guide/system-data',
    children: [
      {
        key: 'overview',
        label: '系统数据总览',
        path: '/guide/system-data/overview',
      },
      {
        key: 'analysis',
        label: '系统数据分析',
        path: '/guide/system-data/analysis',
      },
    ],
  },
  {
    key: 'point-manage',
    label: '点位管理',
    path: '/guide/point-manage',
    children: [
      {
        key: 'spm',
        label: 'SPM管理',
        path: '/guide/point-manage/spm',
      },
      {
        key: 'scm',
        label: 'SCM管理',
        path: '/guide/point-manage/scm',
      },
    ],
  },
]

function Guide() {
  const navigate = useNavigate()
  const location = useLocation()
  const currentPath = location.pathname.replace('/guide', '') || '/'

  // 扁平化菜单项，用于查找当前路径
  const flattenMenuItems = (items: typeof guideMenuItems): Array<{ key: string; path: string; label: string }> => {
    const result: Array<{ key: string; path: string; label: string }> = []
    items.forEach(item => {
      result.push({ key: item.key, path: item.path, label: item.label })
      if (item.children) {
        item.children.forEach(child => {
          result.push({ key: child.key, path: child.path, label: child.label })
          if (child.children) {
            child.children.forEach(grandChild => {
              result.push({ key: grandChild.key, path: grandChild.path, label: grandChild.label })
            })
          }
        })
      }
    })
    return result
  }

  const flatItems = useMemo(() => flattenMenuItems(guideMenuItems), [])

  // 构建菜单项
  const menuItems: MenuProps['items'] = guideMenuItems.map(item => ({
    key: item.key,
    label: item.label,
    icon: <FileTextOutlined />,
    children: item.children?.map(child => ({
      key: child.key,
      label: child.label,
      children: child.children?.map(grandChild => ({
        key: grandChild.key,
        label: grandChild.label,
      })),
    })),
  }))

  // 获取当前选中的菜单项
  const selectedKeys = useMemo(() => {
    const currentItem = flatItems.find(item => {
      const itemPath = item.path.replace('/guide', '')
      return currentPath === itemPath || currentPath.startsWith(itemPath + '/')
    })
    return currentItem ? [currentItem.key] : []
  }, [currentPath, flatItems])

  // 获取展开的菜单项
  const openKeys = useMemo(() => {
    const keys: string[] = []
    guideMenuItems.forEach(item => {
      const itemPath = item.path.replace('/guide', '')
      const hasActiveChild = item.children?.some(child => {
        const childPath = child.path.replace('/guide', '')
        return currentPath === childPath || currentPath.startsWith(childPath + '/')
      })
      if (hasActiveChild || currentPath.startsWith(itemPath + '/')) {
        keys.push(item.key)
      }
    })
    return keys
  }, [currentPath])

  const handleMenuClick = ({ key }: { key: string }) => {
    const item = flatItems.find(i => i.key === key)
    if (item) {
      navigate(item.path)
    }
  }

  // 判断是否是首页（没有子路径或路径为根路径）
  const isIndexPage = currentPath === '/' || currentPath === ''

  return (
    <div className={styles.container}>
      <PageHeader title="系统说明" />
      <div className={`${styles.content} ${isIndexPage ? styles.indexPage : ''}`}>
        {!isIndexPage && (
          <div className={styles.sidebar}>
            <Card className={styles.menuCard}>
              <Menu
                mode="inline"
                selectedKeys={selectedKeys}
                defaultOpenKeys={openKeys}
                items={menuItems}
                onClick={handleMenuClick}
              />
            </Card>
          </div>
        )}
        <div className={styles.main}>
          {isIndexPage ? (
            <Suspense fallback={<Loading />}>
              <GuideIndex />
            </Suspense>
          ) : (
            <Outlet />
          )}
        </div>
      </div>
    </div>
  )
}

export default Guide
