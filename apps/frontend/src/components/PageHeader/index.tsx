import React, { ReactNode } from "react"
import { Button } from "antd"
import { Refresh } from "@icon-park/react"
import * as styles from "./styles.module.scss"

interface IPageHeaderProps {
  /** 标题文本 */
  title: string
  /** 刷新回调函数 */
  onRefresh?: () => void
  /** 刷新按钮的加载状态 */
  loading?: boolean
  /** 右侧内容（如日期选择器等） */
  extra?: ReactNode
  /** 自定义类名 */
  className?: string
}

/**
 * 统一的页面标题组件
 * 包含标题、刷新按钮和可选的右侧内容
 */
function PageHeader(props: IPageHeaderProps) {
  const {
    title,
    onRefresh,
    loading = false,
    extra,
    className = "",
  } = props

  return (
    <div className={`${styles.pageHeader} ${className}`}>
      <div className={styles.titleSection}>
        <h2 className={styles.title}>{title}</h2>
        {onRefresh && (
          <Button
            type="text"
            icon={<Refresh style={{ display: 'flex' }} theme="outline" size="16" fill="#000000" />}
            onClick={onRefresh}
            loading={loading}
            size="small"
            className={styles.refreshBtn}
          />
        )}
      </div>
      {extra && (
        <div className={styles.extraSection}>
          {extra}
        </div>
      )}
    </div>
  )
}

export default PageHeader
