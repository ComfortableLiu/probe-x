import React from "react"
import { Link, useLocation } from "react-router-dom"
import { Breadcrumb } from "antd"
import { ArrowRightOutlined, HomeOutlined } from "@ant-design/icons"
import { getGuideContext } from "../catalog"
import * as styles from "../styles.module.scss"

interface GuideHeaderProps {
  title?: string
}

function GuideHeader({ title }: GuideHeaderProps) {
  const { pathname } = useLocation()
  const { category, entry } = getGuideContext(pathname)
  const items = [
    { title: <Link to="/guide"><HomeOutlined /> 说明首页</Link> },
    ...(category ? [{ title: category.label }] : []),
    ...(entry ? [{ title: entry.label }] : []),
  ]

  return (
    <header className={styles.articleHeader}>
      <Breadcrumb items={items} />
      <div className={styles.articleTitleRow}>
        {title && <h2>{title}</h2>}
        {entry && <Link className={styles.openFeature} to={entry.appPath}>打开功能 <ArrowRightOutlined /></Link>}
      </div>
      {entry && <p className={styles.articleSummary}>{entry.summary}</p>}
    </header>
  )
}

export default GuideHeader
