import dayjs from "dayjs"
import { Button } from "antd"
import { Download, Help, Save } from "@icon-park/react"
import React, { memo, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import * as styles from "./styles.module.scss"

interface IDataAnalysisHeaderProps {
  title: string
  updateTime?: Date
  download?: () => void
  onSaveAsDashboard?: () => void
  guidePath?: string
}

function DataAnalysisHeader(props: IDataAnalysisHeaderProps) {

  const {
    title,
    updateTime,
    download,
    onSaveAsDashboard,
    guidePath,
  } = props

  const navigate = useNavigate()

  // 渲染数据更新时间
  const renderUpdateTime = useMemo(() => {
    if (!updateTime) return null
    return (
      <div className={styles.updateTime}>更新时间：{dayjs(updateTime).format("YYYY-MM-DD HH:mm:ss")}</div>
    )
  }, [updateTime])

  // 渲染下载按钮
  const renderDownloadButton = useMemo(() => {
    if (!download) return null
    return (
      <Button
        type="link"
        onClick={() => download()}
      >
        <Download theme="filled" size="16" fill="currentColor" />
        下载
      </Button>
    )
  }, [download])

  // 渲染保存为看板按钮
  const renderSaveAsDashboardButton = useMemo(() => {
    if (!onSaveAsDashboard) return null
    return (
      <Button
        type="link"
        onClick={() => onSaveAsDashboard()}
      >
        <Save theme="filled" size="16" fill="currentColor" />
        保存为看板
      </Button>
    )
  }, [onSaveAsDashboard])

  // 渲染说明按钮
  const renderGuideButton = useMemo(() => {
    if (!guidePath) return null
    return (
      <Button
        type="link"
        onClick={() => navigate(guidePath)}
        title="查看页面说明"
      >
        <Help theme="outline" size="16" fill="currentColor" />
        说明
      </Button>
    )
  }, [guidePath, navigate])

  return (
    <div className={styles.header}>
      <div className={styles.title}>{title}</div>
      {renderUpdateTime}
      <div className={styles.actions}>
        {renderSaveAsDashboardButton}
        {renderGuideButton}
        {renderDownloadButton}
      </div>
    </div>
  )
}

export default memo(DataAnalysisHeader)
