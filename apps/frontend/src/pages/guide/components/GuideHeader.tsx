import React, { useMemo } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { Breadcrumb, Button } from "antd"
import { ArrowLeftOutlined, HomeOutlined } from "@ant-design/icons"

// 说明页目录结构
const guideMenuItems: Array<{
  key: string
  label: string
  path: string
  children?: Array<{
    key: string
    label: string
    path: string
  }>
}> = [
  {
    key: 'data-analysis',
    label: '数据分析',
    path: '/guide/data-analysis',
    children: [
      { key: 'funnel', label: '漏斗分析', path: '/guide/data-analysis/funnel' },
      { key: 'event', label: '事件分析', path: '/guide/data-analysis/event' },
      { key: 'user-path', label: '用户路径分析', path: '/guide/data-analysis/user-path' },
      { key: 'attribution', label: '归因分析', path: '/guide/data-analysis/attribution' },
      { key: 'dashboard-config', label: '数据看板设置', path: '/guide/data-analysis/dashboard-config' },
    ],
  },
  {
    key: 'system-data',
    label: '系统数据',
    path: '/guide/system-data',
    children: [
      { key: 'overview', label: '系统数据总览', path: '/guide/system-data/overview' },
      { key: 'analysis', label: '系统数据分析', path: '/guide/system-data/analysis' },
    ],
  },
  {
    key: 'point-manage',
    label: '点位管理',
    path: '/guide/point-manage',
    children: [
      { key: 'spm', label: 'SPM管理', path: '/guide/point-manage/spm' },
      { key: 'scm', label: 'SCM管理', path: '/guide/point-manage/scm' },
    ],
  },
]

interface GuideHeaderProps {
  title?: string
}

function GuideHeader({ title }: GuideHeaderProps) {
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
        })
      }
    })
    return result
  }

  const flatItems = useMemo(() => flattenMenuItems(guideMenuItems), [])

  // 构建面包屑导航
  const breadcrumbItems = useMemo(() => {
    const items = [
      {
        title: (
          <span onClick={() => navigate('/guide')} style={{ cursor: 'pointer' }}>
            <HomeOutlined /> 系统说明
          </span>
        ),
      },
    ]

    // 查找当前路径对应的菜单项
    const currentItem = flatItems.find(item => {
      const itemPath = item.path.replace('/guide', '')
      return currentPath === itemPath || currentPath.startsWith(itemPath + '/')
    })

    if (currentItem) {
      // 查找父级菜单
      const parentItem = guideMenuItems.find(item => {
        return item.children?.some(child => child.key === currentItem.key)
      })

      if (parentItem && currentPath !== parentItem.path.replace('/guide', '')) {
        items.push({
          title: (
            <span onClick={() => navigate(parentItem.path)} style={{ cursor: 'pointer' }}>
              {parentItem.label}
            </span>
          ),
        })
      }

      items.push({
        title: currentItem.label,
      })
    }

    return items
  }, [currentPath, flatItems, navigate])

  return (
    <div style={{ marginBottom: 16 }}>
      {title && <h2 style={{ margin: 0, marginBottom: 12 }}>{title}</h2>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Button
          type="text"
          size="small"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate(-1)}
          style={{ padding: '4px 8px', minWidth: 'auto' }}
        />
        <Breadcrumb items={breadcrumbItems} />
      </div>
    </div>
  )
}

export default GuideHeader
