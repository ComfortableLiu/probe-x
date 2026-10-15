import React, { lazy, Suspense, useEffect, useRef, useState } from "react"
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom"
import { Menu, Select } from "antd"
import { BookOutlined, FileTextOutlined } from "@ant-design/icons"
import PageHeader from "@components/PageHeader"
import Loading from "@components/Loading"
import { getGuideContext, guideCategories, normalizeGuidePath } from "./catalog"
import * as styles from "./styles.module.scss"

const GuideIndex = lazy(() => import('./pages/index'))
const menuItems = [
  { key: 'home', icon: <BookOutlined />, label: <Link to="/guide">说明首页</Link> },
  ...guideCategories.map(category => ({
    key: category.key,
    label: category.label,
    icon: <FileTextOutlined />,
    children: category.items.map(entry => ({ key: entry.key, label: <Link to={entry.path}>{entry.label}</Link> })),
  })),
]
const selectOptions = [
  { label: '说明首页', value: '/guide' },
  ...guideCategories.map(category => ({
    label: category.label,
    options: category.items.map(entry => ({ label: entry.label, value: entry.path })),
  })),
]

function Guide() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const containerRef = useRef<HTMLDivElement>(null)
  const { category, entry } = getGuideContext(pathname)
  const isIndexPage = normalizeGuidePath(pathname) === '/guide'
  const [openKeys, setOpenKeys] = useState<string[]>(category ? [category.key] : guideCategories.map(item => item.key))

  useEffect(() => {
    if (category) setOpenKeys(keys => keys.includes(category.key) ? keys : [...keys, category.key])
    containerRef.current?.scrollIntoView({ block: 'start' })
  }, [pathname, category])

  return (
    <div className={styles.container} ref={containerRef}>
      <PageHeader title="系统说明" />
      <p className={styles.pageIntro}>操作指南、指标口径与常见问题</p>
      <div className={styles.content}>
        <nav className={styles.sidebar} aria-label="系统说明目录">
          <div className={styles.menuCard}>
            <div className={styles.menuTitle}>使用指南</div>
            <Menu
              mode="inline"
              inlineIndent={16}
              selectedKeys={entry ? [entry.key] : isIndexPage ? ['home'] : []}
              openKeys={openKeys}
              onOpenChange={setOpenKeys}
              items={menuItems}
            />
          </div>
        </nav>
        <div className={styles.mobileNav}>
          <label htmlFor="guide-page-select">说明目录</label>
          <Select
            id="guide-page-select"
            aria-label="选择说明页面"
            value={entry?.path || (isIndexPage ? '/guide' : undefined)}
            options={selectOptions}
            onChange={value => navigate(value)}
            showSearch
            optionFilterProp="label"
            placeholder="选择说明页面"
          />
        </div>
        <div className={styles.main}>
          <Suspense fallback={<Loading />}>
            {isIndexPage ? <GuideIndex /> : <Outlet />}
          </Suspense>
        </div>
      </div>
    </div>
  )
}

export default Guide
